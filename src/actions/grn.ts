"use server";

import { revalidatePath } from "next/cache";
import {
  GRNEventType,
  POEventType,
  QcInspectionStep,
  StockMovementType,
  TamarindGrade,
} from "@prisma/client";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { buildQrPayload, buildTraceCode, buildWarehouseBatch, barcodeSvg, qrSvg } from "@/lib/grn-codes";
import { syncPoLifecycle } from "@/lib/po-metrics";
import { requirePermission } from "@/lib/session";
import { toNumber } from "@/lib/utils";

async function logGrnEvent(
  grnId: string,
  eventType: GRNEventType,
  title: string,
  opts?: { detail?: string; userId?: string },
) {
  try {
    await prisma.gRNEvent.create({
      data: { grnId, eventType, title, detail: opts?.detail ?? null, userId: opts?.userId ?? null },
    });
  } catch {
    /* schema migrating */
  }
}

async function logPoEvent(purchaseId: string, eventType: POEventType, title: string, userId?: string) {
  try {
    await prisma.pOEvent.create({ data: { purchaseId, eventType, title, userId: userId ?? null } });
  } catch {
    /* schema migrating */
  }
}

function inferGrade(moisture: number | null, seedRatio: number | null): TamarindGrade {
  if (moisture != null && moisture > 14) return "REJECT";
  if (moisture != null && moisture <= 10 && seedRatio != null && seedRatio <= 15) return "PREMIUM";
  if (moisture != null && moisture <= 12) return "GRADE_A";
  if (moisture != null && moisture <= 14) return "GRADE_B";
  return "GRADE_A";
}

const qcParamsSchema = z.object({
  moisturePct: z.number().min(0).max(100).optional(),
  acidityPct: z.number().min(0).max(100).optional(),
  pulpYieldPct: z.number().min(0).max(100).optional(),
  seedRatioPct: z.number().min(0).max(100).optional(),
  foreignMatterPct: z.number().min(0).max(100).optional(),
  microbialPass: z.boolean().optional(),
  tamarindGrade: z.nativeEnum(TamarindGrade).optional(),
  qcNotes: z.string().optional(),
});

export async function markDeliveryReceived(purchaseId: string): Promise<ActionResult<{ grnId: string }>> {
  const user = await requirePermission("purchases.edit");
  const po = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { items: { include: { product: true } }, vendor: true, grn: true },
  });
  if (!po) return actionFail("Purchase order not found");
  if (po.grn) return actionOk({ grnId: po.grn.id });
  if (!["APPROVED", "SENT", "PARTIALLY_RECEIVED"].includes(po.poStatus)) {
    return actionFail("PO must be approved before receiving delivery");
  }

  const grnNumber = `GRN-${po.purchaseNumber.replace("PO-", "")}`;
  const mobileRef = `MOB-${Date.now().toString(36).toUpperCase()}`;

  const grn = await prisma.$transaction(async (tx) => {
    const header = await tx.goodsReceiptNote.create({
      data: {
        grnNumber,
        purchaseId,
        warehouseId: po.warehouseId,
        status: "PENDING",
        lifecycle: "DELIVERY_RECEIVED",
        deliveryReceivedAt: new Date(),
        receivedById: user.id,
        intakeValue: po.total,
        mobileReceiptRef: mobileRef,
        barcodeData: grnNumber,
        qrCodeData: buildQrPayload(grnNumber, grnNumber, po.vendor.name),
        stockUpdated: false,
      },
    });

    let seq = 1;
    for (const item of po.items) {
      const traceCode = buildTraceCode(grnNumber, item.product.sku, seq);
      const whBatch = buildWarehouseBatch(null, traceCode);
      const qr = buildQrPayload(traceCode, grnNumber, item.product.name);
      const grnItem = await tx.gRNItem.create({
        data: {
          grnId: header.id,
          purchaseItemId: item.id,
          productId: item.productId,
          orderedQty: item.quantity,
          receivedQty: 0,
          warehouseId: po.warehouseId,
          warehouseBatch: whBatch,
          fifoRank: seq,
        },
      });
      await tx.gRNBatchTrace.create({
        data: {
          grnItemId: grnItem.id,
          warehouseBatch: whBatch,
          traceCode,
          barcodeData: barcodeSvg(traceCode),
          qrCodeData: qrSvg(qr),
        },
      });
      seq += 1;
    }

    await tx.purchase.update({
      where: { id: purchaseId },
      data: { shipmentStatus: "DELIVERED", procurementStage: "GRN_RECEIVED" },
    });
    return header;
  });

  await logGrnEvent(grn.id, "DELIVERY_RECEIVED", "Delivery received at gate", { userId: user.id });
  await logPoEvent(purchaseId, "GRN_PARTIAL", "Delivery received — GRN draft created", user.id);
  revalidatePath("/procurement/grn");
  revalidatePath(`/purchases/${purchaseId}`);
  return actionOk({ grnId: grn.id });
}

export async function createGrnReceipt(
  grnId: string,
  lines: { purchaseItemId: string; receivedQty: number; damagedQty?: number; supplierBatch?: string }[],
): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  const grn = await prisma.goodsReceiptNote.findUnique({
    where: { id: grnId },
    include: { purchase: { include: { items: true } }, items: true },
  });
  if (!grn) return actionFail("GRN not found");

  await prisma.$transaction(async (tx) => {
    for (const line of lines) {
      const poItem = grn.purchase.items.find((i) => i.id === line.purchaseItemId);
      if (!poItem) continue;
      const damaged = line.damagedQty ?? 0;
      const received = line.receivedQty;
      const grnItem = grn.items.find((i) => i.purchaseItemId === line.purchaseItemId);
      if (grnItem) {
        await tx.gRNItem.update({
          where: { id: grnItem.id },
          data: {
            receivedQty: received,
            damagedQty: damaged,
            acceptedQty: Math.max(0, received - damaged),
            supplierBatch: line.supplierBatch ?? grnItem.supplierBatch,
          },
        });
      }
      await tx.purchaseItem.update({
        where: { id: poItem.id },
        data: { receivedQty: received, acceptedQty: Math.max(0, received - damaged) },
      });
    }

    const totalOrdered = grn.purchase.items.reduce((s, i) => s + toNumber(i.quantity), 0);
    const totalReceived = lines.reduce((s, l) => s + l.receivedQty, 0);
    const isFull = totalReceived >= totalOrdered * 0.999;

    await tx.goodsReceiptNote.update({
      where: { id: grnId },
      data: { lifecycle: "GRN_CREATED", status: isFull ? "RECEIVED" : "PARTIAL", receivedAt: new Date() },
    });
    await tx.purchase.update({
      where: { id: grn.purchaseId },
      data: { poStatus: "PARTIALLY_RECEIVED", procurementStage: "GRN_RECEIVED" },
    });
  });

  await logGrnEvent(grnId, "GRN_CREATED", "GRN posted with received quantities", { userId: user.id });
  revalidatePath(`/procurement/grn/${grnId}`);
  revalidatePath("/procurement/grn");
  return actionOk(undefined);
}

export async function autoCreateGrnsFromDeliveredPos(): Promise<ActionResult<{ created: number }>> {
  await requirePermission("purchases.edit");
  const pos = await prisma.purchase.findMany({
    where: { shipmentStatus: "DELIVERED", grn: null, poStatus: { in: ["APPROVED", "SENT", "PARTIALLY_RECEIVED"] } },
    select: { id: true },
  });
  let created = 0;
  for (const po of pos) {
    const res = await markDeliveryReceived(po.id);
    if (res.ok) created += 1;
  }
  return actionOk({ created });
}

export async function startQcInspection(grnId: string): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  await prisma.goodsReceiptNote.update({
    where: { id: grnId },
    data: { lifecycle: "QC_INSPECTION", qcStartedAt: new Date(), qcOfficerId: user.id, status: "QC_HOLD" },
  });
  await prisma.gRNInspection.create({
    data: {
      grnId,
      step: QcInspectionStep.SAMPLE_COLLECTION,
      officerId: user.id,
      sampleRef: `SMP-${Date.now().toString(36).slice(-6).toUpperCase()}`,
    },
  });
  await logGrnEvent(grnId, "SAMPLE_COLLECTED", "QC sample collection started", { userId: user.id });
  await logGrnEvent(grnId, "INSPECTION_STARTED", "QC inspection in progress", { userId: user.id });
  revalidatePath(`/procurement/grn/${grnId}`);
  return actionOk(undefined);
}

export async function recordQcInspection(grnId: string, params: z.infer<typeof qcParamsSchema>): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  const parsed = qcParamsSchema.safeParse(params);
  if (!parsed.success) return actionFail("Invalid QC parameters");
  const p = parsed.data;
  const grade = p.tamarindGrade ?? inferGrade(p.moisturePct ?? null, p.seedRatioPct ?? null);

  await prisma.$transaction(async (tx) => {
    await tx.goodsReceiptNote.update({
      where: { id: grnId },
      data: {
        moisturePct: p.moisturePct,
        acidityPct: p.acidityPct,
        pulpYieldPct: p.pulpYieldPct,
        seedRatioPct: p.seedRatioPct,
        foreignMatterPct: p.foreignMatterPct,
        microbialPass: p.microbialPass,
        tamarindGrade: grade,
        qcNotes: p.qcNotes,
      },
    });
    await tx.gRNInspection.create({
      data: {
        grnId,
        step: QcInspectionStep.INSPECTION,
        officerId: user.id,
        moisturePct: p.moisturePct,
        acidityPct: p.acidityPct,
        pulpYieldPct: p.pulpYieldPct,
        seedRatioPct: p.seedRatioPct,
        foreignMatterPct: p.foreignMatterPct,
        microbialPass: p.microbialPass,
        tamarindGrade: grade,
        notes: p.qcNotes,
      },
    });
    const items = await tx.gRNItem.findMany({ where: { grnId } });
    for (const item of items) {
      await tx.gRNItem.update({
        where: { id: item.id },
        data: {
          moisturePct: p.moisturePct,
          acidityPct: p.acidityPct,
          pulpYieldPct: p.pulpYieldPct,
          seedRatioPct: p.seedRatioPct,
          foreignMatterPct: p.foreignMatterPct,
          microbialPass: p.microbialPass,
          tamarindGrade: grade,
        },
      });
    }
  });
  revalidatePath(`/procurement/grn/${grnId}`);
  return actionOk(undefined);
}

export async function approveGrnQc(grnId: string): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  const grn = await prisma.goodsReceiptNote.findUnique({
    where: { id: grnId },
    include: { purchase: { include: { vendor: true } }, items: { include: { product: true } } },
  });
  if (!grn) return actionFail("GRN not found");

  await prisma.$transaction(async (tx) => {
    await tx.goodsReceiptNote.update({
      where: { id: grnId },
      data: { lifecycle: "QC_APPROVED", qcPassed: true, qcCompletedAt: new Date(), status: "RECEIVED" },
    });
    for (const item of grn.items) {
      const accepted = Math.max(0, toNumber(item.receivedQty) - toNumber(item.damagedQty) - toNumber(item.rejectedQty));
      await tx.gRNItem.update({ where: { id: item.id }, data: { qcStatus: "PASSED", acceptedQty: accepted } });
    }
    await tx.gRNInspection.create({ data: { grnId, step: QcInspectionStep.APPROVAL, officerId: user.id, passed: true } });
    await tx.purchase.update({ where: { id: grn.purchaseId }, data: { procurementStage: "QUALITY_CHECK" } });
    await tx.vendorQualityRecord.create({
      data: {
        vendorId: grn.purchase.vendorId,
        purchaseId: grn.purchaseId,
        grnId,
        productName: grn.items[0]?.product.name ?? "Mixed",
        batchRef: grn.supplierBatchRef,
        tamarindGrade: grn.tamarindGrade,
        moisturePct: grn.moisturePct,
        qualityScore: 90,
        passed: true,
        notes: grn.qcNotes,
      },
    });
    for (const std of ["FSSAI", "HACCP", "ISO_22000"] as const) {
      await tx.complianceAuditLog.create({
        data: {
          grnId,
          standard: std,
          passed: true,
          auditorId: user.id,
          checklist: { moisture: grn.moisturePct, grade: grn.tamarindGrade, microbial: grn.microbialPass },
        },
      });
    }
  });

  await logGrnEvent(grnId, "QC_APPROVED", "QC approved by officer", { userId: user.id });
  await logPoEvent(grn.purchaseId, "QC_PASSED", "Inbound QC passed", user.id);
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entityType: "GoodsReceiptNote",
    entityId: grnId,
    message: "GRN QC approved",
  });
  revalidatePath(`/procurement/grn/${grnId}`);
  revalidatePath("/procurement/grn");
  return actionOk(undefined);
}

export async function rejectGrnQc(grnId: string, reason: string): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  await prisma.$transaction(async (tx) => {
    await tx.goodsReceiptNote.update({
      where: { id: grnId },
      data: { lifecycle: "QC_REJECTED", qcPassed: false, qcCompletedAt: new Date(), status: "REJECTED", qcNotes: reason },
    });
    await tx.gRNItem.updateMany({ where: { grnId }, data: { qcStatus: "FAILED" } });
    await tx.gRNInspection.create({
      data: { grnId, step: QcInspectionStep.REJECTION, officerId: user.id, passed: false, notes: reason },
    });
  });
  const grn = await prisma.goodsReceiptNote.findUnique({ where: { id: grnId } });
  if (grn) await logPoEvent(grn.purchaseId, "QC_FAILED", `QC rejected: ${reason}`, user.id);
  await logGrnEvent(grnId, "QC_REJECTED", "QC rejected", { detail: reason, userId: user.id });
  revalidatePath(`/procurement/grn/${grnId}`);
  return actionOk(undefined);
}

export async function quarantineGrn(grnId: string, reason: string): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  const items = await prisma.gRNItem.findMany({ where: { grnId } });
  await prisma.$transaction(async (tx) => {
    await tx.goodsReceiptNote.update({
      where: { id: grnId },
      data: { lifecycle: "QUARANTINE", status: "QC_HOLD", quarantineReason: reason },
    });
    for (const item of items) {
      await tx.gRNItem.update({
        where: { id: item.id },
        data: {
          quarantineQty: Math.max(0, toNumber(item.receivedQty) - toNumber(item.damagedQty)),
          qcStatus: "HOLD",
        },
      });
    }
    await tx.gRNInspection.create({
      data: { grnId, step: QcInspectionStep.QUARANTINE, officerId: user.id, notes: reason },
    });
  });
  await logGrnEvent(grnId, "QUARANTINE", "Lot moved to quarantine", { detail: reason, userId: user.id });
  revalidatePath(`/procurement/grn/${grnId}`);
  return actionOk(undefined);
}

export async function releaseFromQuarantine(grnId: string): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  await prisma.goodsReceiptNote.update({
    where: { id: grnId },
    data: { lifecycle: "QC_INSPECTION", status: "QC_HOLD" },
  });
  await prisma.gRNInspection.create({
    data: {
      grnId,
      step: QcInspectionStep.WAREHOUSE_RELEASE,
      officerId: user.id,
      passed: true,
      notes: "Released from quarantine",
    },
  });
  await logGrnEvent(grnId, "RELEASED_FROM_QUARANTINE", "Released from quarantine for re-inspection", { userId: user.id });
  revalidatePath(`/procurement/grn/${grnId}`);
  return actionOk(undefined);
}

const allocationSchema = z.array(
  z.object({ grnItemId: z.string(), binId: z.string(), expiryDate: z.string().optional() }),
);

export async function allocateGrnToWarehouse(
  grnId: string,
  allocations: z.infer<typeof allocationSchema>,
): Promise<ActionResult> {
  await requirePermission("purchases.edit");
  const parsed = allocationSchema.safeParse(allocations);
  if (!parsed.success) return actionFail("Invalid bin allocations");

  await prisma.$transaction(async (tx) => {
    for (const a of parsed.data) {
      await tx.gRNItem.update({
        where: { id: a.grnItemId },
        data: { binId: a.binId, expiryDate: a.expiryDate ? new Date(a.expiryDate) : undefined },
      });
    }
    await tx.goodsReceiptNote.update({ where: { id: grnId }, data: { lifecycle: "WAREHOUSE_ALLOCATED" } });
  });
  await logGrnEvent(grnId, "WAREHOUSE_ALLOCATED", "Bins allocated (FIFO/FEFO)");
  revalidatePath(`/procurement/grn/${grnId}`);
  return actionOk(undefined);
}

export async function postGrnToStock(grnId: string): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  const grn = await prisma.goodsReceiptNote.findUnique({
    where: { id: grnId },
    include: {
      purchase: { include: { vendor: true } },
      items: { include: { product: true, batchTrace: true } },
    },
  });
  if (!grn) return actionFail("GRN not found");
  if (!grn.qcPassed) return actionFail("QC must be approved before posting to stock");
  if (grn.stockUpdated) return actionFail("Stock already updated for this GRN");

  await prisma.$transaction(async (tx) => {
    for (const item of grn.items) {
      const qty = toNumber(item.acceptedQty);
      if (qty <= 0) continue;
      await tx.product.update({ where: { id: item.productId }, data: { stockQty: { increment: qty } } });
      const batchNum = item.warehouseBatch ?? item.batchTrace?.warehouseBatch ?? `B-${grn.grnNumber}`;
      await tx.batch.upsert({
        where: { productId_batchNumber: { productId: item.productId, batchNumber: batchNum } },
        create: {
          productId: item.productId,
          batchNumber: batchNum,
          quantity: qty,
          supplierBatch: item.supplierBatch,
          grnItemId: item.id,
          expiryDate: item.expiryDate,
          mfgDate: new Date(),
        },
        update: { quantity: { increment: qty } },
      });
      await tx.stockMovement.create({
        data: {
          productId: item.productId,
          warehouseId: item.warehouseId ?? grn.warehouseId,
          type: StockMovementType.IN,
          quantity: qty,
          reference: grn.grnNumber,
          notes: `GRN QC-approved intake from ${grn.purchase.vendor.name}`,
        },
      });
    }
    await tx.goodsReceiptNote.update({ where: { id: grnId }, data: { lifecycle: "STOCK_UPDATED", stockUpdated: true } });
    await tx.purchase.update({
      where: { id: grn.purchaseId },
      data: { poStatus: "FULLY_RECEIVED", procurementStage: "QUALITY_CHECK" },
    });
  });

  await logGrnEvent(grnId, "STOCK_UPDATED", "Accepted quantities posted to inventory", { userId: user.id });
  await logPoEvent(grn.purchaseId, "GRN_RECEIVED", "GRN stock posted", user.id);
  await syncPoLifecycle(grn.purchaseId);
  revalidatePath(`/procurement/grn/${grnId}`);
  revalidatePath("/inventory");
  revalidatePath(`/purchases/${grn.purchaseId}`);
  return actionOk(undefined);
}

export async function initiateVendorReturn(
  grnId: string,
  data: { quantity: number; reason: string },
): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  const grn = await prisma.goodsReceiptNote.findUnique({ where: { id: grnId } });
  if (!grn) return actionFail("GRN not found");
  const returnNumber = `RTV-${grn.grnNumber.replace("GRN-", "")}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
  await prisma.gRNVendorReturn.create({
    data: {
      grnId,
      returnNumber,
      status: "PENDING",
      quantity: data.quantity,
      reason: data.reason,
      initiatedById: user.id,
    },
  });
  await prisma.goodsReceiptNote.update({ where: { id: grnId }, data: { lifecycle: "RETURNED_TO_VENDOR" } });
  await logGrnEvent(grnId, "RETURN_INITIATED", "Return to vendor initiated", { detail: data.reason, userId: user.id });
  revalidatePath(`/procurement/grn/${grnId}`);
  return actionOk(undefined);
}

export async function receivePurchaseGoodsEnterprise(
  purchaseId: string,
  partialPct = 100,
): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  let grn = await prisma.goodsReceiptNote.findUnique({ where: { purchaseId } });
  if (!grn) {
    const created = await markDeliveryReceived(purchaseId);
    if (!created.ok) return created;
    grn = await prisma.goodsReceiptNote.findUnique({ where: { id: created.data.grnId } });
  }
  if (!grn) return actionFail("Could not create GRN");

  const po = await prisma.purchase.findUnique({ where: { id: purchaseId }, include: { items: true } });
  if (!po) return actionFail("PO not found");

  const ratio = Math.min(100, Math.max(1, partialPct)) / 100;
  const lines = po.items.map((item) => ({
    purchaseItemId: item.id,
    receivedQty: Math.min(toNumber(item.quantity), Math.round(toNumber(item.quantity) * ratio * 1000) / 1000),
    damagedQty: 0,
  }));
  await createGrnReceipt(grn.id, lines);

  await logPoEvent(
    purchaseId,
    partialPct >= 99 ? "GRN_RECEIVED" : "GRN_PARTIAL",
    partialPct >= 99 ? "Full GRN receipt recorded (awaiting QC)" : "Partial GRN receipt recorded",
    user.id,
  );
  revalidatePath(`/purchases/${purchaseId}`);
  revalidatePath("/procurement/grn");
  return actionOk(undefined);
}
