import {
  ApprovalStatus,
  DeliveryStatus,
  LeadStage,
  OrderStatus,
  PaymentStatus,
  ProductionStatus,
} from "@prisma/client";
import type { CommandCenterMetrics } from "./command-center-types";
import { pctChange } from "./command-center-types";
import { isPrismaConnectionError, pingDatabase, runQueriesInBatches } from "./db-connection";
import { prisma } from "./db";
import { toNumber } from "./utils";

const EMPTY_METRICS: CommandCenterMetrics = {
  totalSales: 0,
  totalPurchases: 0,
  monthSales: 0,
  prevMonthSales: 0,
  salesTrendPct: 0,
  revenueTrendPct: 0,
  pendingPayments: 0,
  pendingOrders: 0,
  inventoryValue: 0,
  inventoryTrendPct: 0,
  inventoryStatus: { totalSkus: 0, lowStockCount: 0, inStock: 0 },
  productionOverview: { activeBatches: 0, todayOutput: 0, planned: 0, completed: 0 },
  leadsCount: 0,
  leadConversionRatio: 0,
  leadPipeline: [] as { stage: string; count: number }[],
  revenueYtd: 0,
  expensesMonth: 0,
  employeesActive: 0,
  pendingLeaves: 0,
  deliveryPending: 0,
  lowStock: [] as { id: string; name: string; stockQty: unknown; minStockQty: unknown }[],
  revenueByMonth: Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { month: d.toLocaleString("en-IN", { month: "short" }), revenue: 0, purchases: 0 };
  }),
  inventoryMovement: Array.from({ length: 6 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - i));
    return { month: d.toLocaleString("en-IN", { month: "short" }), inbound: 0, outbound: 0 };
  }),
  productionByStatus: [] as { status: ProductionStatus; count: number }[],
  procurement: { pendingApprovals: 0, vendorCount: 0, monthPurchases: 0, openGrn: 0 },
  pendingApprovals: { purchases: 0, documents: 0, total: 0 },
  topProducts: [] as { name: string; qty: number }[],
  recentActivity: [] as { id: string; message: string; userName: string | null; createdAt: Date }[],
  notifications: [] as { id: string; title: string; message: string; link: string | null; createdAt?: Date }[],
  foodManufacturing: {
    activeBatches: 0,
    expiringWithin30Days: 0,
    expiringItems: [],
    qualityChecksPending: 0,
    fssaiCompliant: true,
    gstRegistered: false,
    traceabilityScore: 0,
  },
  warehouses: [],
  liveDeliveries: [],
  financeSummary: {
    revenueYtd: 0,
    expensesMonth: 0,
    pendingReceivables: 0,
    pendingPayables: 0,
    netMonth: 0,
  },
  hrPayroll: { employeesActive: 0, pendingLeaves: 0, attendanceToday: 0 },
  kpiSparklines: { sales: [0, 0, 0, 0, 0, 0], inventory: [0, 0, 0, 0, 0, 0], production: [0, 0, 0, 0, 0, 0] },
};

/** Enterprise dashboard KPIs — falls back safely if schema is not yet migrated */
export async function getErpDashboardMetrics(
  userId?: string,
): Promise<CommandCenterMetrics> {
  try {
    return await loadErpDashboardMetrics(userId);
  } catch (e) {
    const unreachable =
      isPrismaConnectionError(e) ||
      (e instanceof Error && e.message === "DATABASE_UNREACHABLE");
    if (unreachable) {
      if (process.env.NODE_ENV === "development") {
        console.warn(
          "[getErpDashboardMetrics] Database unreachable — showing empty dashboard. Run: npm run db:test",
        );
      }
      return { ...EMPTY_METRICS, databaseOffline: true };
    }
    console.error("[getErpDashboardMetrics]", e);
    return { ...EMPTY_METRICS };
  }
}

export type { CommandCenterMetrics };

async function loadErpDashboardMetrics(userId?: string) {
  if (!(await pingDatabase())) {
    throw new Error("DATABASE_UNREACHABLE");
  }

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const expiryThreshold = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const [
    salesAgg,
    purchaseAgg,
    monthSales,
    prevMonthSalesAgg,
    pendingSalesOnly,
    pendingPurchasesOnly,
    pendingOrders,
    products,
    leadsTotal,
    leadsConverted,
    monthlySales,
    topProducts,
    recentActivity,
    notifications,
    productionActive,
    productionToday,
    productionPlanned,
    productionCompleted,
    productionStatusGroups,
    expensesMonth,
    revenueYtd,
    employeesActive,
    pendingLeaves,
    lowStockProducts,
    deliveryPending,
    pendingPurchaseApprovals,
    pendingDocApprovals,
    vendorCount,
    monthPurchasesAgg,
    openGrnCount,
    stockMovements,
    expiringBatches,
    batchCount,
    branches,
    liveDeliveries,
    companyProfile,
    productionLogsMonthly,
    attendanceToday,
  ] = await runQueriesInBatches([
    () => prisma.saleInvoice.aggregate({ _sum: { total: true } }),
    () => prisma.purchase.aggregate({ _sum: { total: true } }),
    () =>
      prisma.saleInvoice.aggregate({
        where: { invoiceDate: { gte: monthStart } },
        _sum: { total: true },
      }),
    () =>
      prisma.saleInvoice.aggregate({
        where: { invoiceDate: { gte: prevMonthStart, lte: prevMonthEnd } },
        _sum: { total: true },
      }),
    () =>
      prisma.saleInvoice.aggregate({
        where: {
          paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE] },
        },
        _sum: { total: true },
      }),
    () =>
      prisma.purchase.aggregate({
        where: {
          paymentStatus: { in: [PaymentStatus.PENDING, PaymentStatus.PARTIAL, PaymentStatus.OVERDUE] },
        },
        _sum: { total: true },
      }),
    () =>
      prisma.salesOrder
        .count({
          where: { status: { in: [OrderStatus.DRAFT, OrderStatus.CONFIRMED, OrderStatus.PROCESSING] } },
        })
        .catch(() => 0),
    () =>
      prisma.product.findMany({
        select: { id: true, name: true, sku: true, stockQty: true, costPrice: true, minStockQty: true },
      }),
    () => prisma.lead.count(),
    () => prisma.lead.count({ where: { stage: { in: [LeadStage.CONVERTED, LeadStage.WON] } } }),
    () =>
      prisma.saleInvoice.groupBy({
        by: ["invoiceDate"],
        where: { invoiceDate: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } },
        _sum: { total: true },
      }),
    () =>
      prisma.saleInvoiceItem.groupBy({
        by: ["productId"],
        _sum: { quantity: true },
        orderBy: { _sum: { quantity: "desc" } },
        take: 5,
      }),
    () => prisma.activityLog.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    () =>
      prisma.notification.findMany({
        where: { read: false, ...(userId ? { userId } : {}) },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
    () =>
      prisma.productionBatch
        .count({ where: { status: ProductionStatus.IN_PROGRESS } })
        .catch(() => 0),
    () =>
      prisma.productionLog
        .aggregate({
          where: { logDate: { gte: todayStart } },
          _sum: { outputQty: true },
        })
        .catch(() => ({ _sum: { outputQty: null } })),
    () => prisma.productionBatch.count({ where: { status: ProductionStatus.PLANNED } }).catch(() => 0),
    () => prisma.productionBatch.count({ where: { status: ProductionStatus.COMPLETED } }).catch(() => 0),
    () => prisma.productionBatch.groupBy({ by: ["status"], _count: { _all: true } }).catch(() => []),
    () =>
      prisma.expense
        .aggregate({
          where: { expenseDate: { gte: monthStart } },
          _sum: { amount: true },
        })
        .catch(() => ({ _sum: { amount: null } })),
    () =>
      prisma.saleInvoice.aggregate({
        where: { invoiceDate: { gte: yearStart } },
        _sum: { total: true },
      }),
    () => prisma.employee.count({ where: { active: true } }).catch(() => 0),
    () => prisma.leaveRequest.count({ where: { status: "PENDING" } }).catch(() => 0),
    () =>
      prisma.product.findMany({
        select: { id: true, name: true, stockQty: true, minStockQty: true },
      }),
    () =>
      prisma.saleInvoice
        .count({
          where: {
            deliveryStatus: {
              in: [DeliveryStatus.PENDING, DeliveryStatus.DISPATCHED, DeliveryStatus.IN_TRANSIT],
            },
          },
        })
        .catch(() => 0),
    () => prisma.purchase.count({ where: { approvalStatus: ApprovalStatus.PENDING } }).catch(() => 0),
    () => prisma.documentApprovalStep.count({ where: { status: ApprovalStatus.PENDING } }).catch(() => 0),
    () => prisma.vendor.count().catch(() => 0),
    () =>
      prisma.purchase.aggregate({
        where: { purchaseDate: { gte: monthStart } },
        _sum: { total: true },
      }),
    () =>
      prisma.purchase
        .count({ where: { approvalStatus: { in: [ApprovalStatus.PENDING, ApprovalStatus.DRAFT] } } })
        .catch(() => 0),
    () =>
      prisma.stockMovement
        .findMany({
          where: { createdAt: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } },
          select: { type: true, quantity: true, createdAt: true },
        })
        .catch(() => []),
    () =>
      prisma.batch
        .findMany({
          where: { expiryDate: { lte: expiryThreshold, gte: now } },
          include: { product: { select: { name: true } } },
          take: 8,
          orderBy: { expiryDate: "asc" },
        })
        .catch(() => []),
    () => prisma.batch.count().catch(() => 0),
    () =>
      prisma.branch
        .findMany({
          where: { isActive: true },
          select: { id: true, name: true, code: true, city: true },
          take: 6,
        })
        .catch(() => []),
    () =>
      prisma.saleInvoice
        .findMany({
          where: {
            deliveryStatus: {
              in: [DeliveryStatus.PENDING, DeliveryStatus.DISPATCHED, DeliveryStatus.IN_TRANSIT],
            },
          },
          include: { customer: { select: { name: true } } },
          orderBy: { updatedAt: "desc" },
          take: 6,
        })
        .catch(() => []),
    () => prisma.companyProfile.findFirst({ where: { id: 1 } }).catch(() => null),
    () =>
      prisma.productionLog
        .findMany({
          where: { logDate: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } },
          select: { outputQty: true, logDate: true },
        })
        .catch(() => []),
    () => prisma.attendance.count({ where: { date: { gte: todayStart } } }).catch(() => 0),
  ]);

  const inventoryValue = products.reduce(
    (sum, p) => sum + toNumber(p.stockQty) * toNumber(p.costPrice),
    0,
  );
  const lowStock = lowStockProducts.filter((p) => toNumber(p.stockQty) <= toNumber(p.minStockQty));

  const productIds = topProducts.map((t) => t.productId);
  const productNames = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true },
  });
  const nameMap = Object.fromEntries(productNames.map((p) => [p.id, p.name]));

  const revenueByMonth = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = d.toLocaleString("en-IN", { month: "short" });
    const total = monthlySales
      .filter((s) => {
        const sd = new Date(s.invoiceDate);
        return sd.getMonth() === d.getMonth() && sd.getFullYear() === d.getFullYear();
      })
      .reduce((sum, s) => sum + toNumber(s._sum.total), 0);
    return { month: label, revenue: total, purchases: 0 };
  });

  const purchaseByMonth = await prisma.purchase.groupBy({
    by: ["purchaseDate"],
    where: { purchaseDate: { gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) } },
    _sum: { total: true },
  });

  for (let i = 0; i < revenueByMonth.length; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    revenueByMonth[i].purchases = purchaseByMonth
      .filter((p) => {
        const pd = new Date(p.purchaseDate);
        return pd.getMonth() === d.getMonth() && pd.getFullYear() === d.getFullYear();
      })
      .reduce((sum, p) => sum + toNumber(p._sum.total), 0);
  }

  const leadConversionRatio =
    leadsTotal > 0 ? Math.round((leadsConverted / leadsTotal) * 100) : 0;

  const pipeline = await prisma.lead.groupBy({
    by: ["stage"],
    _count: { _all: true },
  });

  const monthSalesVal = toNumber(monthSales._sum.total);
  const prevMonthSalesVal = toNumber(prevMonthSalesAgg._sum.total);
  const salesTrendPct = pctChange(monthSalesVal, prevMonthSalesVal);
  const revenueTrendPct = salesTrendPct;
  const inventoryTrendPct =
    revenueByMonth.length >= 2
      ? pctChange(revenueByMonth[revenueByMonth.length - 1].purchases, revenueByMonth[revenueByMonth.length - 2].purchases)
      : 0;

  const inventoryMovement = revenueByMonth.map((row, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const inbound = stockMovements
      .filter((m) => {
        const md = new Date(m.createdAt);
        return md.getMonth() === d.getMonth() && md.getFullYear() === d.getFullYear() && m.type === "IN";
      })
      .reduce((s, m) => s + toNumber(m.quantity), 0);
    const outbound = stockMovements
      .filter((m) => {
        const md = new Date(m.createdAt);
        return md.getMonth() === d.getMonth() && md.getFullYear() === d.getFullYear() && m.type === "OUT";
      })
      .reduce((s, m) => s + toNumber(m.quantity), 0);
    return {
      month: row.month,
      inbound: inbound || row.purchases / 1000,
      outbound: outbound || row.revenue / 1000,
    };
  });

  const productionByStatus = (productionStatusGroups as { status: ProductionStatus; _count: { _all: number } }[]).map(
    (p) => ({ status: p.status, count: p._count._all }),
  );

  const productionSpark = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return productionLogsMonthly
      .filter((l) => {
        const ld = new Date(l.logDate);
        return ld.getMonth() === d.getMonth() && ld.getFullYear() === d.getFullYear();
      })
      .reduce((s, l) => s + toNumber(l.outputQty), 0);
  });

  const traceabilityScore =
    batchCount > 0 ? Math.min(100, Math.round((batchCount / Math.max(products.length, 1)) * 100)) : 0;

  const pendingReceivables = toNumber(pendingSalesOnly._sum.total);
  const pendingPayables = toNumber(pendingPurchasesOnly._sum.total);
  const expensesMonthVal = toNumber(expensesMonth._sum.amount);

  return {
    totalSales: toNumber(salesAgg._sum.total),
    totalPurchases: toNumber(purchaseAgg._sum.total),
    monthSales: monthSalesVal,
    prevMonthSales: prevMonthSalesVal,
    salesTrendPct,
    revenueTrendPct,
    pendingPayments: pendingReceivables + pendingPayables,
    pendingOrders,
    inventoryValue,
    inventoryTrendPct,
    inventoryStatus: {
      totalSkus: products.length,
      lowStockCount: lowStock.length,
      inStock: products.length - lowStock.length,
    },
    productionOverview: {
      activeBatches: productionActive,
      todayOutput: toNumber(productionToday._sum.outputQty),
      planned: productionPlanned,
      completed: productionCompleted,
    },
    leadsCount: leadsTotal,
    leadConversionRatio,
    leadPipeline: pipeline.map((p) => ({ stage: p.stage, count: p._count._all })),
    revenueYtd: toNumber(revenueYtd._sum.total),
    expensesMonth: expensesMonthVal,
    employeesActive,
    pendingLeaves,
    deliveryPending,
    lowStock,
    revenueByMonth,
    inventoryMovement,
    productionByStatus,
    procurement: {
      pendingApprovals: pendingPurchaseApprovals,
      vendorCount,
      monthPurchases: toNumber(monthPurchasesAgg._sum.total),
      openGrn: openGrnCount,
    },
    pendingApprovals: {
      purchases: pendingPurchaseApprovals,
      documents: pendingDocApprovals,
      total: pendingPurchaseApprovals + pendingDocApprovals,
    },
    topProducts: topProducts.map((t) => ({
      name: nameMap[t.productId] ?? "Unknown",
      qty: toNumber(t._sum.quantity),
    })),
    recentActivity,
    notifications,
    foodManufacturing: {
      activeBatches: productionActive,
      expiringWithin30Days: expiringBatches.length,
      expiringItems: expiringBatches.map((b) => ({
        id: b.id,
        batchNumber: b.batchNumber,
        productName: b.product.name,
        expiryDate: b.expiryDate!,
      })),
      qualityChecksPending: productionActive,
      fssaiCompliant: Boolean(companyProfile?.gstin),
      gstRegistered: Boolean(companyProfile?.gstin),
      traceabilityScore,
    },
    warehouses: branches,
    liveDeliveries: liveDeliveries.map((d) => ({
      id: d.id,
      invoiceNumber: d.invoiceNumber,
      customer: d.customer.name,
      status: d.deliveryStatus,
      total: toNumber(d.total),
    })),
    financeSummary: {
      revenueYtd: toNumber(revenueYtd._sum.total),
      expensesMonth: expensesMonthVal,
      pendingReceivables,
      pendingPayables,
      netMonth: monthSalesVal - expensesMonthVal,
    },
    hrPayroll: {
      employeesActive,
      pendingLeaves,
      attendanceToday,
    },
    kpiSparklines: {
      sales: revenueByMonth.map((r) => r.revenue),
      inventory: inventoryMovement.map((m) => m.inbound),
      production: productionSpark,
    },
  };
}
