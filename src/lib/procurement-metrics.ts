import type {
  Prisma,
  ProcurementApprovalState,
  ProcurementApprovalType,
  ProcurementStage,
  VendorClassification,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { isProcurementVendorSchemaReady } from "@/lib/prisma-schema-ready";
import {
  safeModelCount,
  safeModelFindMany,
  safeModelFindUnique,
  safeQuery,
} from "@/lib/prisma-safe";
import { VENDOR_CLASSIFICATION_LABELS } from "@/lib/vendor-types";
import { toNumber } from "@/lib/utils";
import {
  type ApprovalRow,
  type BudgetRow,
  type CategorySpend,
  type ForecastPoint,
  type GrnListRow,
  type LifecycleStep,
  LIFECYCLE_LABELS,
  LIFECYCLE_STAGES,
  type PayableAgingBucket,
  type PayableRow,
  type ProcurementHubAnalytics,
  type ProcurementHubKpis,
  type SpendTrendPoint,
  type VendorComparisonRow,
} from "@/lib/procurement-types";

const MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthKey(d: Date): string {
  return `${MONTHS_SHORT[d.getMonth()]} '${String(d.getFullYear()).slice(-2)}`;
}

/** Derive synchronized lifecycle stage from PO, GRN, QC, bill, and payment state. */
export function deriveProcurementStage(p: {
  procurementStage: ProcurementStage;
  paymentStatus: string;
  billUrl: string | null;
  billRecordedAt: Date | null;
  rfqId: string | null;
  grn: {
    status: string;
    qcPassed: boolean;
    items?: { qcStatus: string }[];
  } | null;
}): ProcurementStage {
  if (p.procurementStage === "CANCELLED") return "CANCELLED";
  if (p.paymentStatus === "PAID") return "PAID";
  if (p.billUrl || p.billRecordedAt) return "BILLED";
  if (p.grn) {
    const items = p.grn.items ?? [];
    const allPassed = items.length > 0 && items.every((i) => i.qcStatus === "PASSED");
    if (p.grn.qcPassed || allPassed) return "QUALITY_CHECK";
    if (p.grn.status === "RECEIVED" || p.grn.status === "PARTIAL") return "GRN_RECEIVED";
    if (p.grn.status === "QC_HOLD") return "QUALITY_CHECK";
  }
  if (p.rfqId && p.procurementStage === "DRAFT") return "RFQ";
  if (p.procurementStage === "DRAFT") return "DRAFT";
  if (p.rfqId && !p.grn) return "RFQ";
  return p.procurementStage;
}

export { scoreRfqQuote } from "@/lib/rfq-metrics";

export async function getProcurementHubAnalytics(): Promise<ProcurementHubAnalytics> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const purchases = await safeQuery(
    () =>
      prisma.purchase.findMany({
        include: {
          vendor: { select: { id: true, name: true, classification: true, qualityScore: true, rejectionRate: true, deliveryScore: true } },
          payments: { select: { amount: true } },
          grn: { include: { items: { select: { qcStatus: true } } } },
          approvals: true,
          items: { select: { quantity: true, unitPrice: true, product: { select: { name: true } } } },
        },
        orderBy: { purchaseDate: "desc" },
      }),
    [],
  );

  const budgets = await safeModelFindMany<{
    month: number;
    fiscalYear: number;
    budgetAmount: unknown;
    spentAmount: unknown;
    alertThresholdPct: unknown;
    classification: VendorClassification;
    label: string;
  }>("procurementBudget");
  const rfqCount = await safeModelCount("procurementRFQ", {
    where: { status: { in: ["SENT", "QUOTED", "COMPARED", "APPROVED"] } },
  });
  const pendingGrns = await safeModelCount("goodsReceiptNote", {
    where: { status: { in: ["PENDING", "PARTIAL", "QC_HOLD"] } },
  });
  const contracts = await safeModelCount("vendorContract", {
    where: { endDate: { lte: new Date(Date.now() + 60 * 86400000) }, status: { in: ["ACTIVE", "EXPIRING"] } },
  });

  let spendThisMonth = 0;
  let spendLastMonth = 0;
  let outstanding = 0;
  let overdue = 0;
  let pendingApprovals = 0;
  let qcHolds = 0;
  const monthSpend = new Map<string, number>();
  const categoryMap = new Map<VendorClassification, { spend: number; count: number }>();
  const vendorMap = new Map<
    string,
    { name: string; spend: number; pos: number; prices: number[]; quality: number[]; rejection: number[]; onTime: number; delivered: number }
  >();

  const lifecycleCounts = new Map<ProcurementStage, { count: number; value: number }>();
  for (const s of LIFECYCLE_STAGES) lifecycleCounts.set(s, { count: 0, value: 0 });

  for (const p of purchases) {
    const total = toNumber(p.total);
    const paid = p.payments.reduce((s, pay) => s + toNumber(pay.amount), 0);
    const stage = deriveProcurementStage({
      procurementStage: p.procurementStage,
      paymentStatus: p.paymentStatus,
      billUrl: p.billUrl,
      billRecordedAt: p.billRecordedAt,
      rfqId: p.rfqId,
      grn: p.grn,
    });

    const lc = lifecycleCounts.get(stage) ?? { count: 0, value: 0 };
    lc.count += 1;
    lc.value += total;
    lifecycleCounts.set(stage, lc);

    const mk = monthKey(p.purchaseDate);
    monthSpend.set(mk, (monthSpend.get(mk) ?? 0) + total);

    if (p.purchaseDate >= monthStart) spendThisMonth += total;
    if (p.purchaseDate >= lastMonthStart && p.purchaseDate < monthStart) spendLastMonth += total;

    const balance = total - paid;
    if (balance > 0.01) {
      outstanding += balance;
      const due = p.dueDate ?? new Date(p.purchaseDate.getTime() + 30 * 86400000);
      if (due < now && p.paymentStatus !== "PAID") overdue += balance;
    }

    const pending = p.approvals?.filter((a) => a.status === "PENDING") ?? [];
    if (pending.length > 0) pendingApprovals += 1;
    if (p.grn?.status === "QC_HOLD") qcHolds += 1;

    const cls = p.vendor.classification;
    const cat = categoryMap.get(cls) ?? { spend: 0, count: 0 };
    cat.spend += total;
    cat.count += 1;
    categoryMap.set(cls, cat);

    const v = vendorMap.get(p.vendorId) ?? {
      name: p.vendor.name,
      spend: 0,
      pos: 0,
      prices: [],
      quality: [],
      rejection: [],
      onTime: 0,
      delivered: 0,
    };
    v.spend += total;
    v.pos += 1;
    if (p.vendor.qualityScore != null) v.quality.push(toNumber(p.vendor.qualityScore));
    if (p.vendor.rejectionRate != null) v.rejection.push(toNumber(p.vendor.rejectionRate));
    if (p.vendor.deliveryScore != null) v.onTime += toNumber(p.vendor.deliveryScore);
    v.delivered += 1;
    for (const item of p.items) {
      v.prices.push(toNumber(item.unitPrice));
    }
    vendorMap.set(p.vendorId, v);
  }

  const spendTrend: SpendTrendPoint[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);
    const spend = monthSpend.get(key) ?? 0;
    const forecast = Math.round(spend * 1.08 + spendThisMonth * 0.05);
    const budgetRow = budgets.find((b) => b.month === d.getMonth() + 1 && b.fiscalYear === d.getFullYear());
    spendTrend.push({
      month: key,
      spend,
      forecast: i === 0 ? spendThisMonth : forecast,
      budget: budgetRow ? toNumber(budgetRow.budgetAmount) : undefined,
    });
  }

  const categorySpend: CategorySpend[] = [...categoryMap.entries()].map(([classification, data]) => {
    const budget = budgets.find((b) => b.classification === classification);
    return {
      classification,
      label: VENDOR_CLASSIFICATION_LABELS[classification],
      spend: data.spend,
      count: data.count,
      budget: budget ? toNumber(budget.budgetAmount) : undefined,
    };
  });

  const vendorComparison: VendorComparisonRow[] = [...vendorMap.entries()]
    .map(([vendorId, v]) => ({
      vendorId,
      vendorName: v.name,
      spend: v.spend,
      poCount: v.pos,
      onTimePct: v.delivered ? v.onTime / v.delivered : 90,
      qualityScore: v.quality.length ? v.quality.reduce((a, b) => a + b, 0) / v.quality.length : 87,
      rejectionRate: v.rejection.length ? v.rejection.reduce((a, b) => a + b, 0) / v.rejection.length : 2,
      avgUnitPrice: v.prices.length ? v.prices.reduce((a, b) => a + b, 0) / v.prices.length : 0,
      rank: 0,
    }))
    .sort((a, b) => b.spend - a.spend)
    .map((row, i) => ({ ...row, rank: i + 1 }))
    .slice(0, 8);

  const payables = purchases
    .map((p): PayableRow | null => {
      const total = toNumber(p.total);
      const paid = p.payments.reduce((s, pay) => s + toNumber(pay.amount), 0);
      const balance = total - paid;
      if (balance <= 0.01) return null;
      const due = p.dueDate ?? new Date(p.purchaseDate.getTime() + 30 * 86400000);
      const daysOverdue = due < now ? Math.floor((now.getTime() - due.getTime()) / 86400000) : 0;
      return {
        id: p.id,
        purchaseNumber: p.purchaseNumber,
        vendorName: p.vendor.name,
        vendorId: p.vendorId,
        total,
        paid,
        balance,
        dueDate: due.toISOString(),
        daysOverdue,
        stage: deriveProcurementStage({
          procurementStage: p.procurementStage,
          paymentStatus: p.paymentStatus,
          billUrl: p.billUrl,
          billRecordedAt: p.billRecordedAt,
          rfqId: p.rfqId,
          grn: p.grn,
        }),
        paymentStatus: p.paymentStatus,
      };
    })
    .filter((x): x is PayableRow => x != null)
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  const aging: PayableAgingBucket[] = [
    { bucket: "Current", count: 0, amount: 0 },
    { bucket: "1–30 days", count: 0, amount: 0 },
    { bucket: "31–60 days", count: 0, amount: 0 },
    { bucket: "60+ days", count: 0, amount: 0 },
  ];
  for (const row of payables) {
    let idx = 0;
    if (row.daysOverdue > 60) idx = 3;
    else if (row.daysOverdue > 30) idx = 2;
    else if (row.daysOverdue > 0) idx = 1;
    aging[idx].count += 1;
    aging[idx].amount += row.balance;
  }

  let budgetUtilizationPct = 0;
  let budgetAlerts = 0;
  if (budgets.length > 0) {
    const totalBudget = budgets.reduce((s, b) => s + toNumber(b.budgetAmount), 0);
    const totalSpent = budgets.reduce((s, b) => s + toNumber(b.spentAmount), 0);
    budgetUtilizationPct = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 1000) / 10 : 0;
    budgetAlerts = budgets.filter((b) => {
      const util = toNumber(b.budgetAmount) > 0 ? toNumber(b.spentAmount) / toNumber(b.budgetAmount) : 0;
      return util * 100 >= toNumber(b.alertThresholdPct);
    }).length;
  }

  const forecast: ForecastPoint[] = spendTrend.map((s) => ({
    month: s.month,
    actual: s.spend,
    forecast: s.forecast ?? s.spend,
  }));

  const lifecycle: LifecycleStep[] = LIFECYCLE_STAGES.map((stage) => {
    const data = lifecycleCounts.get(stage) ?? { count: 0, value: 0 };
    const href =
      stage === "RFQ"
        ? "/procurement/rfq"
        : stage === "GRN_RECEIVED" || stage === "QUALITY_CHECK"
          ? "/procurement/grn"
          : stage === "BILLED" || stage === "PAID"
            ? "/procurement/payables"
            : "/purchases";
    return { stage, label: LIFECYCLE_LABELS[stage], count: data.count, value: data.value, href };
  });

  const kpis: ProcurementHubKpis = {
    totalPos: purchases.length,
    activeRfqs: rfqCount,
    pendingApprovals,
    pendingGrns,
    qcHolds,
    outstandingPayables: outstanding,
    overduePayables: overdue,
    spendThisMonth,
    spendLastMonth,
    budgetUtilizationPct,
    budgetAlerts,
    onTimeDeliveryPct: vendorComparison.length
      ? Math.round(vendorComparison.reduce((s, v) => s + v.onTimePct, 0) / vendorComparison.length)
      : 91,
    avgQualityScore: vendorComparison.length
      ? Math.round((vendorComparison.reduce((s, v) => s + v.qualityScore, 0) / vendorComparison.length) * 10) / 10
      : 88,
    avgRejectionRate: vendorComparison.length
      ? Math.round((vendorComparison.reduce((s, v) => s + v.rejectionRate, 0) / vendorComparison.length) * 10) / 10
      : 2.2,
    expiringContracts: contracts,
  };

  return {
    kpis,
    lifecycle,
    spendTrend,
    categorySpend,
    vendorComparison,
    payablesAging: aging,
    topPayables: payables.slice(0, 10),
    allPayables: payables,
    forecast,
    seasonalInsight:
      "Pre-monsoon tamarind procurement window (Apr–Jun): prioritize Grade A suppliers with moisture ≤12%. FPO partners in Bastar show 8% lower unit cost vs spot market.",
  };
}

export async function getAllPayables(): Promise<{ payables: PayableRow[]; aging: PayableAgingBucket[] }> {
  const hub = await getProcurementHubAnalytics();
  return { payables: hub.allPayables ?? hub.topPayables, aging: hub.payablesAging };
}

export async function getGrnList(): Promise<GrnListRow[]> {
  const grns = await safeModelFindMany<{
    id: string;
    grnNumber: string;
    status: string;
    receivedAt: Date | null;
    moisturePct: unknown;
    tamarindGrade: string | null;
    qcPassed: boolean;
    purchase: { purchaseNumber: string; vendor: { id: string; name: string } };
    warehouse: { name: string } | null;
    items: { orderedQty: unknown; receivedQty: unknown; damagedQty: unknown }[];
  }>("goodsReceiptNote", {
    include: {
      purchase: { select: { purchaseNumber: true, vendor: { select: { id: true, name: true } } } },
      warehouse: { select: { name: true } },
      items: true,
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return grns.map((g) => {
    const ordered = g.items.reduce((s, i) => s + toNumber(i.orderedQty), 0);
    const received = g.items.reduce((s, i) => s + toNumber(i.receivedQty), 0);
    const damaged = g.items.reduce((s, i) => s + toNumber(i.damagedQty), 0);
    return {
      id: g.id,
      grnNumber: g.grnNumber,
      purchaseNumber: g.purchase.purchaseNumber,
      vendorName: g.purchase.vendor.name,
      vendorId: g.purchase.vendor.id,
      status: g.status,
      warehouseName: g.warehouse?.name ?? null,
      receivedAt: g.receivedAt?.toISOString() ?? null,
      moisturePct: g.moisturePct != null ? toNumber(g.moisturePct) : null,
      tamarindGrade: g.tamarindGrade,
      qcPassed: g.qcPassed,
      itemCount: g.items.length,
      orderedQty: ordered,
      receivedQty: received,
      damagedQty: damaged,
    };
  });
}

export { getApprovalRows, ensurePurchaseApprovals } from "@/lib/approval-metrics";
export { getBudgetRows } from "@/lib/budget-metrics";
export { compareRfqQuotes } from "@/lib/rfq-metrics";

/** Sync PO stage fields from related documents (run after GRN/QC/payment updates). */
export async function syncPurchaseLifecycle(purchaseId: string) {
  if (!isProcurementVendorSchemaReady()) return;

  const p = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { grn: { include: { items: true } }, payments: true },
  });
  if (!p) return;

  const stage = deriveProcurementStage({
    procurementStage: p.procurementStage,
    paymentStatus: p.paymentStatus,
    billUrl: p.billUrl,
    billRecordedAt: p.billRecordedAt,
    rfqId: p.rfqId,
    grn: p.grn,
  });

  if (stage !== p.procurementStage) {
    await prisma.purchase.update({ where: { id: purchaseId }, data: { procurementStage: stage } });
  }
}

