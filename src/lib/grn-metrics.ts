import type { GrnLifecycleStatus, TamarindGrade } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  EMPTY_GRN_KPIS,
  GRN_SEASONAL_INSIGHT,
  gradeIntelligence,
  lifecycleStepIndex,
  type GrnDetailDto,
  type GrnExecutionKpis,
  type GrnListRow,
  type SupplierQcTrendPoint,
} from "@/lib/grn-types";
import { safeQuery } from "@/lib/prisma-safe";
import { toNumber } from "@/lib/utils";

const grnInclude = {
  purchase: {
    select: {
      id: true,
      purchaseNumber: true,
      total: true,
      vendor: { select: { id: true, name: true, qualityScore: true } },
    },
  },
  warehouse: { select: { id: true, name: true } },
  qcOfficer: { select: { name: true } },
  items: {
    include: {
      product: { select: { id: true, name: true, sku: true } },
      bin: { select: { code: true } },
      batchTrace: true,
    },
  },
  inspections: { include: { officer: { select: { name: true } } }, orderBy: { completedAt: "desc" as const } },
  events: { orderBy: { createdAt: "desc" as const }, take: 40 },
  vendorReturns: true,
  complianceLogs: { orderBy: { auditedAt: "desc" as const } },
} as const;

function mapListRow(g: {
  id: string;
  grnNumber: string;
  status: string;
  lifecycle: GrnLifecycleStatus;
  receivedAt: Date | null;
  moisturePct: unknown;
  tamarindGrade: TamarindGrade | null;
  qcPassed: boolean;
  stockUpdated: boolean;
  intakeValue: unknown;
  purchase: { id: string; purchaseNumber: string; total: unknown; vendor: { id: string; name: string } };
  warehouse: { name: string } | null;
  items: { orderedQty: unknown; receivedQty: unknown; damagedQty: unknown; rejectedQty: unknown; qcStatus: string }[];
}): GrnListRow {
  const ordered = g.items.reduce((s, i) => s + toNumber(i.orderedQty), 0);
  const received = g.items.reduce((s, i) => s + toNumber(i.receivedQty), 0);
  const damaged = g.items.reduce((s, i) => s + toNumber(i.damagedQty), 0);
  const rejected = g.items.reduce((s, i) => s + toNumber(i.rejectedQty), 0);
  const pendingQc = g.items.filter((i) => i.qcStatus === "PENDING" || i.qcStatus === "HOLD").length;
  return {
    id: g.id,
    grnNumber: g.grnNumber,
    purchaseNumber: g.purchase.purchaseNumber,
    purchaseId: g.purchase.id,
    vendorName: g.purchase.vendor.name,
    vendorId: g.purchase.vendor.id,
    status: g.status as GrnListRow["status"],
    lifecycle: g.lifecycle,
    warehouseName: g.warehouse?.name ?? null,
    receivedAt: g.receivedAt?.toISOString() ?? null,
    moisturePct: g.moisturePct != null ? toNumber(g.moisturePct) : null,
    tamarindGrade: g.tamarindGrade,
    qcPassed: g.qcPassed,
    stockUpdated: g.stockUpdated,
    intakeValue: g.intakeValue != null ? toNumber(g.intakeValue) : toNumber(g.purchase.total),
    itemCount: g.items.length,
    orderedQty: ordered,
    receivedQty: received,
    damagedQty: damaged,
    rejectedQty: rejected,
    pendingQcItems: pendingQc,
    isQuarantine: g.lifecycle === "QUARANTINE",
  };
}

export async function getGrnExecutionKpis(): Promise<GrnExecutionKpis> {
  const grns = await safeQuery(
    () =>
      prisma.goodsReceiptNote.findMany({
        include: {
          purchase: { select: { total: true, vendor: { select: { qualityScore: true } } } },
          items: { select: { qcStatus: true } },
          vendorReturns: { select: { status: true } },
        },
      }),
    [],
  );

  if (!grns.length) return EMPTY_GRN_KPIS;

  let pendingInspections = 0;
  let rejectedBatches = 0;
  let quarantineCount = 0;
  let intakeValue = 0;
  let pendingStockPost = 0;
  let returnsOpen = 0;
  let qualitySum = 0;
  let qualityCount = 0;

  for (const g of grns) {
    if (["QC_INSPECTION", "GRN_CREATED", "DELIVERY_RECEIVED"].includes(g.lifecycle)) pendingInspections += 1;
    if (g.lifecycle === "QC_REJECTED" || g.status === "REJECTED") rejectedBatches += 1;
    if (g.lifecycle === "QUARANTINE") quarantineCount += 1;
    intakeValue += toNumber(g.intakeValue ?? g.purchase.total);
    if (g.qcPassed && !g.stockUpdated) pendingStockPost += 1;
    returnsOpen += g.vendorReturns.filter((r) => !["COMPLETED", "CANCELLED"].includes(r.status)).length;
    const qs = g.purchase.vendor.qualityScore;
    if (qs != null) {
      qualitySum += toNumber(qs);
      qualityCount += 1;
    }
  }

  return {
    totalGrns: grns.length,
    pendingInspections,
    rejectedBatches,
    quarantineCount,
    intakeValue,
    avgVendorQuality: qualityCount ? Math.round((qualitySum / qualityCount) * 10) / 10 : 88,
    pendingStockPost,
    returnsOpen,
  };
}

export async function getGrnList(filters?: {
  q?: string;
  lifecycle?: GrnLifecycleStatus;
}): Promise<GrnListRow[]> {
  const rows = await safeQuery(
    () =>
      prisma.goodsReceiptNote.findMany({
        include: {
          purchase: { select: { id: true, purchaseNumber: true, total: true, vendor: { select: { id: true, name: true } } } },
          warehouse: { select: { name: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
        take: 200,
      }),
    [],
  );

  let list = rows.map((g) => mapListRow(g as Parameters<typeof mapListRow>[0]));

  if (filters?.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(
      (r) =>
        r.grnNumber.toLowerCase().includes(q) ||
        r.purchaseNumber.toLowerCase().includes(q) ||
        r.vendorName.toLowerCase().includes(q),
    );
  }
  if (filters?.lifecycle) list = list.filter((r) => r.lifecycle === filters.lifecycle);

  return list;
}

export async function getGrnDetail(id: string): Promise<GrnDetailDto | null> {
  const g = await safeQuery(
    () => prisma.goodsReceiptNote.findUnique({ where: { id }, include: grnInclude }),
    null,
  );
  if (!g) return null;

  const bins =
    g.warehouseId != null
      ? await safeQuery(
          () => prisma.warehouseBin.findMany({ where: { warehouseId: g.warehouseId!, active: true } }),
          [],
        )
      : [];

  const moisture = g.moisturePct != null ? toNumber(g.moisturePct) : null;
  const seedRatio = g.seedRatioPct != null ? toNumber(g.seedRatioPct) : null;

  return {
    id: g.id,
    grnNumber: g.grnNumber,
    purchaseId: g.purchase.id,
    purchaseNumber: g.purchase.purchaseNumber,
    vendorName: g.purchase.vendor.name,
    vendorId: g.purchase.vendor.id,
    status: g.status,
    lifecycle: g.lifecycle,
    workflowStep: lifecycleStepIndex(g.lifecycle),
    warehouseName: g.warehouse?.name ?? null,
    warehouseId: g.warehouseId,
    receivedAt: g.receivedAt?.toISOString() ?? null,
    qcPassed: g.qcPassed,
    stockUpdated: g.stockUpdated,
    stockRotation: g.stockRotation,
    intakeValue: g.intakeValue != null ? toNumber(g.intakeValue) : toNumber(g.purchase.total),
    moisturePct: moisture,
    acidityPct: g.acidityPct != null ? toNumber(g.acidityPct) : null,
    pulpYieldPct: g.pulpYieldPct != null ? toNumber(g.pulpYieldPct) : null,
    seedRatioPct: seedRatio,
    foreignMatterPct: g.foreignMatterPct != null ? toNumber(g.foreignMatterPct) : null,
    microbialPass: g.microbialPass,
    tamarindGrade: g.tamarindGrade,
    qcNotes: g.qcNotes,
    quarantineReason: g.quarantineReason,
    supplierBatchRef: g.supplierBatchRef,
    barcodeData: g.barcodeData,
    qrCodeData: g.qrCodeData,
    mobileReceiptRef: g.mobileReceiptRef,
    fssaiCompliant: g.fssaiCompliant,
    haccpCompliant: g.haccpCompliant,
    isoCompliant: g.isoCompliant,
    qcOfficerName: g.qcOfficer?.name ?? null,
    gradeIntelligence: gradeIntelligence(g.tamarindGrade, moisture, seedRatio),
    seasonalInsight: GRN_SEASONAL_INSIGHT,
    lineItems: g.items.map((i) => ({
      id: i.id,
      productId: i.productId,
      productName: i.product.name,
      sku: i.product.sku,
      orderedQty: toNumber(i.orderedQty),
      receivedQty: toNumber(i.receivedQty),
      damagedQty: toNumber(i.damagedQty),
      rejectedQty: toNumber(i.rejectedQty),
      quarantineQty: toNumber(i.quarantineQty),
      acceptedQty: toNumber(i.acceptedQty),
      supplierBatch: i.supplierBatch,
      warehouseBatch: i.warehouseBatch,
      moisturePct: i.moisturePct != null ? toNumber(i.moisturePct) : null,
      acidityPct: i.acidityPct != null ? toNumber(i.acidityPct) : null,
      pulpYieldPct: i.pulpYieldPct != null ? toNumber(i.pulpYieldPct) : null,
      seedRatioPct: i.seedRatioPct != null ? toNumber(i.seedRatioPct) : null,
      foreignMatterPct: i.foreignMatterPct != null ? toNumber(i.foreignMatterPct) : null,
      microbialPass: i.microbialPass,
      tamarindGrade: i.tamarindGrade,
      qcStatus: i.qcStatus,
      binCode: i.bin?.code ?? null,
      expiryDate: i.expiryDate?.toISOString() ?? null,
      traceCode: i.batchTrace?.traceCode ?? null,
      barcodeData: i.batchTrace?.barcodeData ?? null,
      qrCodeData: i.batchTrace?.qrCodeData ?? null,
    })),
    inspections: g.inspections.map((ins) => ({
      id: ins.id,
      step: ins.step,
      sampleRef: ins.sampleRef,
      passed: ins.passed,
      moisturePct: ins.moisturePct != null ? toNumber(ins.moisturePct) : null,
      tamarindGrade: ins.tamarindGrade,
      officerName: ins.officer?.name ?? null,
      completedAt: ins.completedAt.toISOString(),
      notes: ins.notes,
    })),
    timeline: g.events.map((e) => ({
      id: e.id,
      eventType: e.eventType,
      title: e.title,
      detail: e.detail,
      createdAt: e.createdAt.toISOString(),
    })),
    vendorReturns: g.vendorReturns.map((r) => ({
      id: r.id,
      returnNumber: r.returnNumber,
      status: r.status,
      quantity: toNumber(r.quantity),
      reason: r.reason,
    })),
    complianceLogs: g.complianceLogs.map((c) => ({
      id: c.id,
      standard: c.standard,
      passed: c.passed,
      auditedAt: c.auditedAt.toISOString(),
    })),
    bins: bins.map((b) => ({ id: b.id, code: b.code, zone: b.zone })),
  };
}

export async function getSupplierQcTrends(): Promise<SupplierQcTrendPoint[]> {
  const records = await safeQuery(
    () =>
      prisma.vendorQualityRecord.findMany({
        orderBy: { recordedAt: "asc" },
        take: 120,
      }),
    [],
  );

  const byMonth = new Map<string, { pass: number; total: number; moisture: number[]; reject: number[] }>();
  for (const r of records) {
    const d = r.recordedAt;
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const bucket = byMonth.get(key) ?? { pass: 0, total: 0, moisture: [], reject: [] };
    bucket.total += 1;
    if (r.passed) bucket.pass += 1;
    if (r.moisturePct != null) bucket.moisture.push(toNumber(r.moisturePct));
    if (r.rejectionPct != null) bucket.reject.push(toNumber(r.rejectionPct));
    byMonth.set(key, bucket);
  }

  return [...byMonth.entries()].slice(-6).map(([month, b]) => ({
    month,
    passRate: b.total ? Math.round((b.pass / b.total) * 100) : 0,
    avgMoisture: b.moisture.length ? Math.round((b.moisture.reduce((a, c) => a + c, 0) / b.moisture.length) * 10) / 10 : 0,
    rejectionRate: b.reject.length ? Math.round((b.reject.reduce((a, c) => a + c, 0) / b.reject.length) * 10) / 10 : 0,
  }));
}

export async function getDeliveredPosAwaitingGrn(): Promise<{ id: string; purchaseNumber: string; vendorName: string }[]> {
  const pos = await safeQuery(
    () =>
      prisma.purchase.findMany({
        where: {
          shipmentStatus: "DELIVERED",
          grn: null,
          poStatus: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] },
        },
        include: { vendor: { select: { name: true } } },
        take: 20,
      }),
    [],
  );
  return pos.map((p) => ({ id: p.id, purchaseNumber: p.purchaseNumber, vendorName: p.vendor.name }));
}
