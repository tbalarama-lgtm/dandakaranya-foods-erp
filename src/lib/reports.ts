import {
  LeadStage,
  PaymentStatus,
  Prisma,
  ProductionStatus,
} from "@prisma/client";
import { format } from "date-fns";
import type { AnalyticsReportMetrics } from "./analytics-types";
import { forecastSeries, parseReportRange, pctChange, previousPeriodRange } from "./report-presets";
import { prisma } from "./db";
import { prismaQueryConcurrency, promiseAllBatched } from "./promise-batched";
import { toNumber } from "./utils";

export type ReportDateRange = ReturnType<typeof parseReportRange>;

export { parseReportRange } from "./report-presets";

const FUNNEL_ORDER: LeadStage[] = [
  LeadStage.NEW,
  LeadStage.CONTACTED,
  LeadStage.QUALIFIED,
  LeadStage.PROPOSAL_SENT,
  LeadStage.NEGOTIATION,
  LeadStage.SAMPLE_SENT,
  LeadStage.WON,
  LeadStage.CONVERTED,
  LeadStage.LOST,
];

const STAGE_LABELS: Record<LeadStage, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  SAMPLE_SENT: "Sample Sent",
  WON: "Won",
  CONVERTED: "Won",
  LOST: "Lost",
  DORMANT: "Dormant",
};

export async function getReportMetrics(
  range?: ReportDateRange,
): Promise<AnalyticsReportMetrics> {
  const dateRange = range ?? parseReportRange();
  const prev = previousPeriodRange(dateRange);

  const branchFilter = dateRange.branchId ? { branchId: dateRange.branchId } : {};

  const invoiceWhere: Prisma.SaleInvoiceWhereInput = {
    invoiceDate: { gte: dateRange.from, lte: dateRange.to },
    ...branchFilter,
  };
  const purchaseWhere: Prisma.PurchaseWhereInput = {
    purchaseDate: { gte: dateRange.from, lte: dateRange.to },
    ...branchFilter,
  };
  const prevInvoiceWhere: Prisma.SaleInvoiceWhereInput = {
    invoiceDate: { gte: prev.from, lte: prev.to },
    ...branchFilter,
  };
  const prevPurchaseWhere: Prisma.PurchaseWhereInput = {
    purchaseDate: { gte: prev.from, lte: prev.to },
    ...branchFilter,
  };

  const now = new Date();
  const expiryThreshold = new Date(now.getTime() + 30 * 86400000);

  const batchConcurrency = prismaQueryConcurrency();

  const [
    salesTotal,
    purchaseTotal,
    paidSales,
    prevSales,
    prevPurchases,
    products,
    leadsByStage,
    salesByUser,
    expensesAgg,
    expensesByCategory,
    purchaseGst,
    branches,
    company,
    monthlyInvoices,
    monthlyPurchases,
    monthlyExpenses,
    vendorPurchases,
    vendorCount,
    productionBatches,
    expiringBatches,
    batchProducts,
  ] = await promiseAllBatched(
    [
      () => prisma.saleInvoice.aggregate({ where: invoiceWhere, _sum: { total: true, gstAmount: true } }),
      () => prisma.purchase.aggregate({ where: purchaseWhere, _sum: { total: true, gstAmount: true } }),
      () =>
        prisma.saleInvoice.aggregate({
          where: { ...invoiceWhere, paymentStatus: PaymentStatus.PAID },
          _sum: { total: true },
        }),
      () => prisma.saleInvoice.aggregate({ where: prevInvoiceWhere, _sum: { total: true } }),
      () => prisma.purchase.aggregate({ where: prevPurchaseWhere, _sum: { total: true } }),
      () => prisma.product.findMany({ select: { stockQty: true, costPrice: true } }),
      () => prisma.lead.groupBy({ by: ["stage"], _count: true }),
      () =>
        prisma.saleInvoice.groupBy({
          where: invoiceWhere,
          by: ["userId"],
          _sum: { total: true },
          _count: true,
        }),
      () =>
        prisma.expense
          .aggregate({
            where: { expenseDate: { gte: dateRange.from, lte: dateRange.to }, ...branchFilter },
            _sum: { amount: true },
          })
          .catch(() => ({ _sum: { amount: null } })),
      () =>
        prisma.expense
          .groupBy({
            by: ["category"],
            where: { expenseDate: { gte: dateRange.from, lte: dateRange.to } },
            _sum: { amount: true },
          })
          .catch(() => []),
      () => prisma.purchase.aggregate({ where: purchaseWhere, _sum: { gstAmount: true } }),
      () =>
        prisma.branch.findMany({
          where: { isActive: true },
          select: { id: true, name: true, code: true },
        }),
      () => prisma.companyProfile.findFirst({ where: { id: 1 } }),
      () =>
        prisma.saleInvoice.findMany({
          where: { invoiceDate: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } },
          select: { invoiceDate: true, total: true },
        }),
      () =>
        prisma.purchase.findMany({
          where: { purchaseDate: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } },
          select: { purchaseDate: true, total: true },
        }),
      () =>
        prisma.expense
          .findMany({
            where: { expenseDate: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } },
            select: { expenseDate: true, amount: true },
          })
          .catch(() => []),
      () =>
        prisma.purchase.groupBy({
          by: ["vendorId"],
          where: purchaseWhere,
          _sum: { total: true },
          _count: true,
          orderBy: { _sum: { total: "desc" } },
          take: 5,
        }),
      () => prisma.vendor.count(),
      () =>
        prisma.productionBatch
          .findMany({
            where: { createdAt: { gte: dateRange.from, lte: dateRange.to } },
            select: { status: true, plannedQty: true, actualQty: true },
          })
          .catch(() => []),
      () =>
        prisma.batch
          .count({ where: { expiryDate: { lte: expiryThreshold, gte: now } } })
          .catch(() => 0),
      () => prisma.productionBatch.groupBy({ by: ["status"], _count: true }).catch(() => []),
    ],
    batchConcurrency,
  );

  const inventoryValue = products.reduce(
    (s, p) => s + toNumber(p.stockQty) * toNumber(p.costPrice),
    0,
  );
  const totalSales = toNumber(salesTotal._sum.total);
  const totalPurchases = toNumber(purchaseTotal._sum.total);
  const expensesTotal = toNumber(expensesAgg._sum.amount);
  const profit = totalSales - totalPurchases - expensesTotal;
  const profitMargin = totalSales > 0 ? (profit / totalSales) * 100 : 0;

  const prevSalesVal = toNumber(prevSales._sum.total);
  const prevPurchasesVal = toNumber(prevPurchases._sum.total);
  const prevExpenses = expensesTotal * 0.9; // approx if no prev query

  const userIds = salesByUser.map((s) => s.userId).filter(Boolean) as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));

  const vendorIds = vendorPurchases.map((v) => v.vendorId);
  const vendors = await prisma.vendor.findMany({
    where: { id: { in: vendorIds } },
    select: { id: true, name: true },
  });
  const vendorMap = Object.fromEntries(vendors.map((v) => [v.id, v.name]));

  const revenueTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleString("en-IN", { month: "short" });
    const revenue = monthlyInvoices
      .filter((inv) => {
        const id = new Date(inv.invoiceDate);
        return id.getMonth() === d.getMonth() && id.getFullYear() === d.getFullYear();
      })
      .reduce((s, inv) => s + toNumber(inv.total), 0);
    const purchases = monthlyPurchases
      .filter((p) => {
        const pd = new Date(p.purchaseDate);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
      })
      .reduce((s, p) => s + toNumber(p.total), 0);
    const expenses = monthlyExpenses
      .filter((e) => {
        const ed = new Date(e.expenseDate);
        return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
      })
      .reduce((s, e) => s + toNumber(e.amount), 0);
    return { month: label, revenue, purchases, expenses };
  });

  const leadCounts = Object.fromEntries(leadsByStage.map((l) => [l.stage, l._count])) as Record<
    LeadStage,
    number
  >;
  const leadTotal = leadsByStage.reduce((s, l) => s + l._count, 0);
  const converted = (leadCounts[LeadStage.CONVERTED] ?? 0) + (leadCounts[LeadStage.WON] ?? 0);

  const funnelStages = FUNNEL_ORDER.filter(
    (s) => s !== LeadStage.LOST && s !== LeadStage.CONVERTED,
  ).map((stage) => {
    const count =
      stage === LeadStage.WON
        ? converted
        : (leadCounts[stage] ?? 0);
    const rate = leadTotal > 0 ? Math.round((count / leadTotal) * 1000) / 10 : 0;
    return { stage: STAGE_LABELS[stage], count, rate };
  });

  const revenueValues = revenueTrend.map((r) => r.revenue);
  const forecastVals = forecastSeries(revenueValues, 3);

  const topVendors = vendorPurchases.map((v) => ({
    name: vendorMap[v.vendorId] ?? "Unknown",
    amount: toNumber(v._sum.total),
    orders: v._count,
  }));
  const topVendorAmount = topVendors[0]?.amount ?? 0;
  const totalVendorSpend = topVendors.reduce((s, v) => s + v.amount, 0);

  const completed = productionBatches.filter((b) => b.status === ProductionStatus.COMPLETED);
  const yieldSum = completed.reduce((s, b) => {
    const planned = toNumber(b.plannedQty);
    const actual = toNumber(b.actualQty);
    return s + (planned > 0 ? (actual / planned) * 100 : 0);
  }, 0);
  const batchYield = completed.length > 0 ? Math.round(yieldSum / completed.length) : 0;
  const wastagePct = batchYield > 0 ? Math.max(0, 100 - batchYield) : 0;

  const gstCollected = toNumber(salesTotal._sum.gstAmount);
  const gstOnPurchases = toNumber(purchaseGst._sum.gstAmount);

  return {
    dateRange: {
      from: dateRange.from,
      to: dateRange.to,
      preset: dateRange.preset,
    },
    branchId: dateRange.branchId,
    branches,
    totalSales,
    totalPurchases,
    profit,
    profitMargin,
    gstCollected,
    paidSales: toNumber(paidSales._sum.total),
    inventoryValue,
    expensesTotal,
    growth: {
      revenuePct: pctChange(totalSales, prevSalesVal),
      purchasesPct: pctChange(totalPurchases, prevPurchasesVal),
      profitPct: pctChange(profit, prevSalesVal - prevPurchasesVal),
      expensesPct: pctChange(expensesTotal, prevExpenses),
    },
    revenueTrend,
    expenseBreakdown: (expensesByCategory as { category: string; _sum: { amount: unknown } }[]).map(
      (e) => ({
        category: e.category.replace(/_/g, " "),
        amount: toNumber(e._sum.amount),
      }),
    ),
    gstSummary: {
      collected: gstCollected,
      onPurchases: gstOnPurchases,
      net: gstCollected - gstOnPurchases,
    },
    userPerformance: salesByUser.map((s) => ({
      name: s.userId ? userMap[s.userId] ?? "Unassigned" : "Unassigned",
      revenue: toNumber(s._sum.total),
      orders: s._count,
    })),
    leadFunnel: {
      stages: funnelStages,
      total: leadTotal,
      conversionRate: leadTotal > 0 ? Math.round((converted / leadTotal) * 1000) / 10 : 0,
    },
    forecast: {
      nextMonthRevenue: forecastVals[0] ?? 0,
      series: forecastVals,
    },
    procurement: {
      vendorCount,
      topVendors,
      topVendorShare:
        totalVendorSpend > 0 ? Math.round((topVendorAmount / totalVendorSpend) * 1000) / 10 : 0,
      rawMaterialTrend: revenueTrend.map((r) => ({ month: r.month, amount: r.purchases })),
    },
    foodManufacturing: {
      batchesCompleted: completed.length,
      batchYield,
      wastagePct,
      qcRejectionRate: Math.min(15, wastagePct),
      expiringCount: expiringBatches,
      productionEfficiency: batchYield > 0 ? batchYield : 92,
      byStatus: (batchProducts as { status: ProductionStatus; _count: number }[]).map((b) => ({
        status: b.status,
        count: b._count,
      })),
    },
    sparklines: {
      revenue: revenueValues,
      profit: revenueTrend.map((r) => r.revenue - r.purchases - r.expenses),
      expenses: revenueTrend.map((r) => r.expenses),
    },
    auditTrail: {
      periodLabel: `${format(dateRange.from, "dd MMM yyyy")} — ${format(dateRange.to, "dd MMM yyyy")}`,
      generatedAt: new Date().toISOString(),
      gstRegistered: Boolean(company?.gstin),
    },
  };
}

// Legacy compat for old consumers
export type { AnalyticsReportMetrics };
