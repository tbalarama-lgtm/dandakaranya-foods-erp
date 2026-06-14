import type { PoLifecycleStatus, ProcurementApprovalType, ProcurementStage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isPoExecutionDbSchemaReady } from "@/lib/db-health";
import { safeQuery } from "@/lib/prisma-safe";
import { toNumber } from "@/lib/utils";
import {
  EMPTY_PO_KPIS,
  PO_SEASONAL_INSIGHT,
  type PoDetailDto,
  type PoExecutionKpis,
  type PoListRow,
} from "@/lib/po-types";

export function procurementStageToPoStatus(
  stage: ProcurementStage,
  approvalStatus: string,
  paymentStatus: string,
): PoLifecycleStatus {
  if (stage === "CANCELLED") return "CANCELLED";
  if (paymentStatus === "PAID" || stage === "PAID") return "PAID";
  if (stage === "BILLED") return "BILLED";
  if (stage === "QUALITY_CHECK") return "FULLY_RECEIVED";
  if (stage === "GRN_RECEIVED") return "PARTIALLY_RECEIVED";
  if (stage === "PO_ISSUED") return approvalStatus === "APPROVED" ? "APPROVED" : "SENT";
  return "DRAFT";
}

const LEGACY_PURCHASE_SELECT = {
  id: true,
  purchaseNumber: true,
  vendorId: true,
  approvalStatus: true,
  procurementStage: true,
  purchaseDate: true,
  expectedDelivery: true,
  total: true,
  paymentStatus: true,
  billUrl: true,
  vendor: { select: { id: true, name: true } },
  warehouse: { select: { name: true } },
  items: { select: { quantity: true } },
} as const;

export function derivePoStatus(p: {
  poStatus: PoLifecycleStatus;
  paymentStatus: string;
  billUrl: string | null;
  billRecordedAt: Date | null;
  grn: { status: string; qcPassed: boolean } | null;
  items: { quantity: unknown; receivedQty: unknown }[];
  approvals: { approvalType: string; status: string }[];
}): PoLifecycleStatus {
  if (p.poStatus === "CANCELLED") return "CANCELLED";
  if (p.paymentStatus === "PAID") return "PAID";
  if (p.billUrl || p.billRecordedAt) return "BILLED";

  const totalQty = p.items.reduce((s, i) => s + toNumber(i.quantity), 0);
  const receivedQty = p.items.reduce((s, i) => s + toNumber(i.receivedQty), 0);
  if (totalQty > 0 && receivedQty >= totalQty * 0.999) return "FULLY_RECEIVED";
  if (receivedQty > 0 || p.grn?.status === "PARTIAL") return "PARTIALLY_RECEIVED";

  const allApproved = ["PROCUREMENT", "FINANCE", "INVENTORY", "BUDGET"].every((t) =>
    p.approvals.some((a) => a.approvalType === t && a.status === "APPROVED"),
  );
  if (allApproved) return "APPROVED";
  if (p.poStatus === "SENT") return "SENT";
  return p.poStatus === "DRAFT" ? "DRAFT" : p.poStatus;
}

export function workflowStepIndex(status: PoLifecycleStatus, hasRfq: boolean, hasGrn: boolean, qcPassed: boolean): number {
  if (status === "PAID") return 6;
  if (status === "BILLED") return 5;
  if (status === "FULLY_RECEIVED" || (hasGrn && qcPassed)) return 4;
  if (status === "PARTIALLY_RECEIVED" || hasGrn) return 3;
  if (status === "APPROVED" || status === "SENT") return hasRfq ? 1 : 1;
  return 0;
}

export async function getPoExecutionKpis(): Promise<PoExecutionKpis> {
  if (!(await isPoExecutionDbSchemaReady())) {
    return getPoExecutionKpisLegacy();
  }

  const pos = await safeQuery(
    () =>
      prisma.purchase.findMany({
        include: {
          items: { select: { quantity: true, receivedQty: true } },
          payments: { select: { amount: true } },
          approvals: true,
        },
      }),
    [],
  );

  const now = new Date();

  let openPos = 0;
  let delayedPos = 0;
  let pendingApproval = 0;
  let awaitingGrn = 0;
  let outstandingValue = 0;
  let paidThisMonth = 0;
  let budgetAlerts = 0;
  let leadSum = 0;
  let leadCount = 0;

  for (const p of pos) {
    const status = derivePoStatus({
      poStatus: p.poStatus,
      paymentStatus: p.paymentStatus,
      billUrl: p.billUrl,
      billRecordedAt: p.billRecordedAt,
      grn: null,
      items: p.items,
      approvals: p.approvals,
    });

    if (!["PAID", "CANCELLED"].includes(status)) {
      openPos += 1;
      outstandingValue += toNumber(p.total);
    }

    if (p.expectedDelivery && p.expectedDelivery < now && !["FULLY_RECEIVED", "BILLED", "PAID", "CANCELLED"].includes(status)) {
      delayedPos += 1;
    }

    const pending = p.approvals.filter((a) => a.status === "PENDING").length;
    if (pending > 0 && ["DRAFT", "SENT"].includes(status)) pendingApproval += 1;

    if (status === "APPROVED") awaitingGrn += 1;

    if (p.budgetAmount && toNumber(p.total) > toNumber(p.budgetAmount)) budgetAlerts += 1;

    if (p.expectedDelivery && p.sentAt) {
      leadSum += (p.expectedDelivery.getTime() - p.sentAt.getTime()) / 86400000;
      leadCount += 1;
    }

    for (const pay of p.payments) {
      if (p.paymentStatus === "PAID") paidThisMonth += toNumber(pay.amount);
    }
  }

  return {
    totalPos: pos.length,
    openPos,
    delayedPos,
    pendingApproval,
    awaitingGrn,
    outstandingValue,
    paidThisMonth,
    avgLeadTimeDays: leadCount ? Math.round(leadSum / leadCount) : 7,
    budgetAlerts,
  };
}

async function getPoExecutionKpisLegacy(): Promise<PoExecutionKpis> {
  const pos = await safeQuery(
    () =>
      prisma.purchase.findMany({
        select: {
          ...LEGACY_PURCHASE_SELECT,
          payments: { select: { amount: true } },
        },
      }),
    [],
  );

  const now = new Date();
  let openPos = 0;
  let delayedPos = 0;
  let pendingApproval = 0;
  let awaitingGrn = 0;
  let outstandingValue = 0;
  let paidThisMonth = 0;

  for (const p of pos) {
    const status = procurementStageToPoStatus(p.procurementStage, p.approvalStatus, p.paymentStatus);

    if (!["PAID", "CANCELLED"].includes(status)) {
      openPos += 1;
      outstandingValue += toNumber(p.total);
    }

    if (
      p.expectedDelivery &&
      p.expectedDelivery < now &&
      !["FULLY_RECEIVED", "BILLED", "PAID", "CANCELLED"].includes(status)
    ) {
      delayedPos += 1;
    }

    if (p.approvalStatus === "PENDING" && ["DRAFT", "SENT"].includes(status)) pendingApproval += 1;
    if (status === "APPROVED") awaitingGrn += 1;

    if (p.paymentStatus === "PAID") {
      for (const pay of p.payments) paidThisMonth += toNumber(pay.amount);
    }
  }

  return {
    ...EMPTY_PO_KPIS,
    totalPos: pos.length,
    openPos,
    delayedPos,
    pendingApproval,
    awaitingGrn,
    outstandingValue,
    paidThisMonth,
    avgLeadTimeDays: 7,
  };
}

export async function getPoList(filters?: { q?: string; status?: PoLifecycleStatus }): Promise<PoListRow[]> {
  if (!(await isPoExecutionDbSchemaReady())) {
    return getPoListLegacy(filters);
  }

  const rows = await safeQuery(
    () =>
      prisma.purchase.findMany({
        include: {
          vendor: { select: { id: true, name: true } },
          warehouse: { select: { name: true } },
          rfq: { select: { rfqNumber: true } },
          items: { select: { quantity: true, receivedQty: true } },
        },
        orderBy: { purchaseDate: "desc" },
        take: 200,
      }),
    [],
  );

  const now = new Date();
  let list: PoListRow[] = rows.map((p) => {
    const totalQty = p.items.reduce((s, i) => s + toNumber(i.quantity), 0);
    const recv = p.items.reduce((s, i) => s + toNumber(i.receivedQty), 0);
    const receivedPct = totalQty > 0 ? Math.round((recv / totalQty) * 100) : 0;
    const budget = p.budgetAmount != null ? toNumber(p.budgetAmount) : null;
    const total = toNumber(p.total);
    const budgetOverPct = budget && total > budget ? Math.round(((total - budget) / budget) * 1000) / 10 : null;
    const isDelayed = Boolean(
      p.expectedDelivery && p.expectedDelivery < now && !["FULLY_RECEIVED", "BILLED", "PAID", "CANCELLED"].includes(p.poStatus),
    );

    return {
      id: p.id,
      purchaseNumber: p.purchaseNumber,
      vendorName: p.vendor.name,
      vendorId: p.vendor.id,
      poStatus: p.poStatus,
      shipmentStatus: p.shipmentStatus,
      purchaseDate: p.purchaseDate.toISOString(),
      expectedDelivery: p.expectedDelivery?.toISOString() ?? null,
      total,
      itemCount: p.items.length,
      receivedPct,
      budgetAmount: budget,
      budgetOverPct,
      isDelayed,
      rfqNumber: p.rfq?.rfqNumber ?? null,
      warehouseName: p.warehouse?.name ?? null,
    };
  });

  if (filters?.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(
      (r) =>
        r.purchaseNumber.toLowerCase().includes(q) ||
        r.vendorName.toLowerCase().includes(q) ||
        (r.rfqNumber?.toLowerCase().includes(q) ?? false),
    );
  }
  if (filters?.status) list = list.filter((r) => r.poStatus === filters.status);

  return list;
}

async function getPoListLegacy(filters?: { q?: string; status?: PoLifecycleStatus }): Promise<PoListRow[]> {
  const rows = await safeQuery(
    () =>
      prisma.purchase.findMany({
        select: LEGACY_PURCHASE_SELECT,
        orderBy: { purchaseDate: "desc" },
        take: 200,
      }),
    [],
  );

  const now = new Date();
  let list: PoListRow[] = rows.map((p) => {
    const poStatus = procurementStageToPoStatus(p.procurementStage, p.approvalStatus, p.paymentStatus);
    const total = toNumber(p.total);
    const isDelayed = Boolean(
      p.expectedDelivery &&
        p.expectedDelivery < now &&
        !["FULLY_RECEIVED", "BILLED", "PAID", "CANCELLED"].includes(poStatus),
    );

    return {
      id: p.id,
      purchaseNumber: p.purchaseNumber,
      vendorName: p.vendor.name,
      vendorId: p.vendor.id,
      poStatus,
      shipmentStatus: "PENDING",
      purchaseDate: p.purchaseDate.toISOString(),
      expectedDelivery: p.expectedDelivery?.toISOString() ?? null,
      total,
      itemCount: p.items.length,
      receivedPct: 0,
      budgetAmount: null,
      budgetOverPct: null,
      isDelayed,
      rfqNumber: null,
      warehouseName: p.warehouse?.name ?? null,
    };
  });

  if (filters?.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(
      (r) => r.purchaseNumber.toLowerCase().includes(q) || r.vendorName.toLowerCase().includes(q),
    );
  }
  if (filters?.status) list = list.filter((r) => r.poStatus === filters.status);

  return list;
}

export async function getPoDetail(id: string): Promise<PoDetailDto | null> {
  if (!(await isPoExecutionDbSchemaReady())) {
    return getPoDetailLegacy(id);
  }

  const p = await safeQuery(
    () =>
      prisma.purchase.findUnique({
        where: { id },
        include: {
          vendor: { select: { id: true, name: true, deliveryScore: true, qualityScore: true } },
          warehouse: { select: { id: true, name: true } },
          rfq: { select: { id: true, rfqNumber: true } },
          items: { include: { product: { select: { id: true, name: true, sku: true } } } },
          approvals: true,
          grn: true,
          events: { orderBy: { createdAt: "desc" }, take: 30 },
        },
      }),
    null,
  );

  if (!p) return null;

  const approvalState = (t: ProcurementApprovalType) =>
    (p.approvals.find((a) => a.approvalType === t)?.status ?? "PENDING") as "PENDING" | "APPROVED" | "REJECTED";

  const totalQty = p.items.reduce((s, i) => s + toNumber(i.quantity), 0);
  const recv = p.items.reduce((s, i) => s + toNumber(i.receivedQty), 0);
  const receivedPct = totalQty > 0 ? Math.round((recv / totalQty) * 100) : 0;

  const yields = p.items.map((i) => toNumber(i.expectedYieldPct)).filter((y) => y > 0);
  const yieldForecastPct = yields.length ? Math.round(yields.reduce((a, b) => a + b, 0) / yields.length) : null;

  const now = new Date();
  const delayDays =
    p.expectedDelivery && p.expectedDelivery < now
      ? Math.floor((now.getTime() - p.expectedDelivery.getTime()) / 86400000)
      : 0;
  const isDelayed = delayDays > 0 && !["FULLY_RECEIVED", "BILLED", "PAID", "CANCELLED"].includes(p.poStatus);

  const budget = p.budgetAmount != null ? toNumber(p.budgetAmount) : null;
  const total = toNumber(p.total);
  let budgetWarning: string | null = null;
  if (budget && total > budget) budgetWarning = `PO exceeds budget by ${Math.round(((total - budget) / budget) * 100)}%`;

  const derivedStatus = derivePoStatus({
    poStatus: p.poStatus,
    paymentStatus: p.paymentStatus,
    billUrl: p.billUrl,
    billRecordedAt: p.billRecordedAt,
    grn: p.grn,
    items: p.items,
    approvals: p.approvals,
  });

  return {
    id: p.id,
    purchaseNumber: p.purchaseNumber,
    vendorName: p.vendor.name,
    vendorId: p.vendor.id,
    poStatus: derivedStatus,
    shipmentStatus: p.shipmentStatus,
    transporter: p.transporter,
    purchaseDate: p.purchaseDate.toISOString(),
    expectedDelivery: p.expectedDelivery?.toISOString() ?? null,
    sentAt: p.sentAt?.toISOString() ?? null,
    dueDate: p.dueDate?.toISOString() ?? null,
    subtotal: toNumber(p.subtotal),
    gstAmount: toNumber(p.gstAmount),
    freightAmount: toNumber(p.freightAmount),
    total,
    budgetAmount: budget,
    budgetWarning,
    paymentStatus: p.paymentStatus,
    billUrl: p.billUrl,
    notes: p.notes,
    rfqId: p.rfq?.id ?? null,
    rfqNumber: p.rfq?.rfqNumber ?? null,
    warehouseName: p.warehouse?.name ?? null,
    warehouseId: p.warehouse?.id ?? null,
    isDelayed,
    delayDays,
    receivedPct,
    yieldForecastPct,
    seasonalInsight: PO_SEASONAL_INSIGHT,
    workflowStep: workflowStepIndex(derivedStatus, Boolean(p.rfqId), Boolean(p.grn), p.grn?.qcPassed ?? false),
    approvals: {
      procurement: approvalState("PROCUREMENT"),
      finance: approvalState("FINANCE"),
      inventory: approvalState("INVENTORY"),
      budget: approvalState("BUDGET"),
    },
    lineItems: p.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      sku: i.product.sku,
      quantity: toNumber(i.quantity),
      unitPrice: toNumber(i.unitPrice),
      gstPercent: toNumber(i.gstPercent),
      gstAmount: toNumber(i.gstAmount),
      freightAmount: toNumber(i.freightAmount),
      lineTotal: toNumber(i.lineTotal),
      tamarindGrade: i.tamarindGrade,
      moisturePct: i.moisturePct != null ? toNumber(i.moisturePct) : null,
      acidityPct: i.acidityPct != null ? toNumber(i.acidityPct) : null,
      seedRatioPct: i.seedRatioPct != null ? toNumber(i.seedRatioPct) : null,
      expectedYieldPct: i.expectedYieldPct != null ? toNumber(i.expectedYieldPct) : null,
      receivedQty: toNumber(i.receivedQty),
      acceptedQty: toNumber(i.acceptedQty),
      batchNumber: i.batchNumber,
    })),
    timeline: p.events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      title: e.title,
      detail: e.detail,
      createdAt: e.createdAt.toISOString(),
    })),
    grn: p.grn
      ? {
          id: p.grn.id,
          grnNumber: p.grn.grnNumber,
          status: p.grn.status,
          qcPassed: p.grn.qcPassed,
          moisturePct: p.grn.moisturePct != null ? toNumber(p.grn.moisturePct) : null,
          tamarindGrade: p.grn.tamarindGrade,
        }
      : null,
    vendorSla: {
      onTimePct: toNumber(p.vendor.deliveryScore) || 90,
      qualityScore: toNumber(p.vendor.qualityScore) || 88,
      avgLeadDays: 7,
    },
  };
}

async function getPoDetailLegacy(id: string): Promise<PoDetailDto | null> {
  const p = await safeQuery(
    () =>
      prisma.purchase.findUnique({
        where: { id },
        select: {
          ...LEGACY_PURCHASE_SELECT,
          dueDate: true,
          subtotal: true,
          gstAmount: true,
          notes: true,
          vendor: { select: { id: true, name: true, deliveryScore: true, qualityScore: true } },
          items: {
            include: { product: { select: { id: true, name: true, sku: true } } },
          },
        },
      }),
    null,
  );

  if (!p) return null;

  const poStatus = procurementStageToPoStatus(p.procurementStage, p.approvalStatus, p.paymentStatus);
  const total = toNumber(p.total);
  const now = new Date();
  const delayDays =
    p.expectedDelivery && p.expectedDelivery < now
      ? Math.floor((now.getTime() - p.expectedDelivery.getTime()) / 86400000)
      : 0;
  const isDelayed = delayDays > 0 && !["FULLY_RECEIVED", "BILLED", "PAID", "CANCELLED"].includes(poStatus);

  return {
    id: p.id,
    purchaseNumber: p.purchaseNumber,
    vendorName: p.vendor.name,
    vendorId: p.vendor.id,
    poStatus,
    shipmentStatus: "PENDING",
    transporter: null,
    purchaseDate: p.purchaseDate.toISOString(),
    expectedDelivery: p.expectedDelivery?.toISOString() ?? null,
    sentAt: null,
    dueDate: p.dueDate?.toISOString() ?? null,
    subtotal: toNumber(p.subtotal),
    gstAmount: toNumber(p.gstAmount),
    freightAmount: 0,
    total,
    budgetAmount: null,
    budgetWarning: null,
    paymentStatus: p.paymentStatus,
    billUrl: p.billUrl,
    notes: p.notes,
    rfqId: null,
    rfqNumber: null,
    warehouseName: p.warehouse?.name ?? null,
    warehouseId: null,
    isDelayed,
    delayDays,
    receivedPct: 0,
    yieldForecastPct: null,
    seasonalInsight: PO_SEASONAL_INSIGHT,
    workflowStep: workflowStepIndex(poStatus, false, false, false),
    approvals: {
      procurement: p.approvalStatus,
      finance: "PENDING",
      inventory: "PENDING",
      budget: "PENDING",
    },
    lineItems: p.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      sku: i.product.sku,
      quantity: toNumber(i.quantity),
      unitPrice: toNumber(i.unitPrice),
      gstPercent: toNumber(i.gstPercent),
      gstAmount: toNumber(i.gstAmount),
      freightAmount: 0,
      lineTotal: toNumber(i.lineTotal),
      tamarindGrade: null,
      moisturePct: null,
      acidityPct: null,
      seedRatioPct: null,
      expectedYieldPct: null,
      receivedQty: 0,
      acceptedQty: 0,
      batchNumber: null,
    })),
    timeline: [],
    grn: null,
    vendorSla: {
      onTimePct: toNumber(p.vendor.deliveryScore) || 90,
      qualityScore: toNumber(p.vendor.qualityScore) || 88,
      avgLeadDays: 7,
    },
  };
}

export async function syncPoLifecycle(purchaseId: string) {
  const p = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { grn: true, items: true, approvals: true },
  });
  if (!p) return;

  const poStatus = derivePoStatus({
    poStatus: p.poStatus,
    paymentStatus: p.paymentStatus,
    billUrl: p.billUrl,
    billRecordedAt: p.billRecordedAt,
    grn: p.grn,
    items: p.items,
    approvals: p.approvals,
  });

  let procurementStage = p.procurementStage;
  if (poStatus === "DRAFT") procurementStage = "DRAFT";
  else if (poStatus === "SENT" || poStatus === "APPROVED") procurementStage = "PO_ISSUED";
  else if (poStatus === "PARTIALLY_RECEIVED") procurementStage = "GRN_RECEIVED";
  else if (poStatus === "FULLY_RECEIVED") procurementStage = p.grn?.qcPassed ? "QUALITY_CHECK" : "GRN_RECEIVED";
  else if (poStatus === "BILLED") procurementStage = "BILLED";
  else if (poStatus === "PAID") procurementStage = "PAID";
  else if (poStatus === "CANCELLED") procurementStage = "CANCELLED";

  if (p.expectedDelivery && p.expectedDelivery < new Date() && ["DISPATCHED", "IN_TRANSIT"].includes(p.shipmentStatus)) {
    await prisma.purchase.update({
      where: { id: purchaseId },
      data: { shipmentStatus: "DELAYED" },
    });
  }

  await prisma.purchase.update({
    where: { id: purchaseId },
    data: { poStatus, procurementStage },
  });
}
