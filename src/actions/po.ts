"use server";

import { revalidatePath } from "next/cache";
import {
  ActivityAction,
  POEventType,
  PoLifecycleStatus,
  ProcurementApprovalState,
  ProcurementApprovalType,
  ShipmentStatus,
} from "@prisma/client";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { ensurePurchaseApprovals, syncPurchaseLifecycle } from "@/lib/procurement-metrics";
import { syncPoLifecycle } from "@/lib/po-metrics";
import { requirePermission } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { approvePurchaseLevel, recordBill } from "@/actions/procurement";

async function logPoEvent(
  purchaseId: string,
  eventType: POEventType,
  title: string,
  opts?: { detail?: string; userId?: string },
) {
  try {
    await prisma.pOEvent.create({
      data: {
        purchaseId,
        eventType,
        title,
        detail: opts?.detail ?? null,
        userId: opts?.userId ?? null,
      },
    });
  } catch {
    /* schema migrating */
  }
}

export async function sendPurchaseOrder(purchaseId: string): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  const po = await prisma.purchase.findUnique({ where: { id: purchaseId } });
  if (!po || po.poStatus !== "DRAFT") return actionFail("PO must be in Draft to send");

  await prisma.purchase.update({
    where: { id: purchaseId },
    data: { poStatus: "SENT", sentAt: new Date(), procurementStage: "PO_ISSUED", shipmentStatus: "DISPATCHED" },
  });
  await ensurePurchaseApprovals(purchaseId);
  await logPoEvent(purchaseId, "SENT", "PO sent to vendor", { userId: user.id });
  await syncPoLifecycle(purchaseId);
  revalidatePath(`/purchases/${purchaseId}`);
  revalidatePath("/purchases");
  return actionOk(undefined);
}

export async function approvePoLevel(
  purchaseId: string,
  approvalType: ProcurementApprovalType,
  status: ProcurementApprovalState,
): Promise<ActionResult> {
  const result = await approvePurchaseLevel(purchaseId, approvalType, status);
  if (!result.ok) return result;

  const allApproved = await prisma.procurementApproval.count({
    where: { purchaseId, status: "APPROVED" },
  });
  if (allApproved >= 4) {
    await prisma.purchase.update({
      where: { id: purchaseId },
      data: { poStatus: "APPROVED", approvalStatus: "APPROVED" },
    });
    await logPoEvent(purchaseId, "APPROVED", "All approvals completed");
  }
  await syncPoLifecycle(purchaseId);
  revalidatePath(`/purchases/${purchaseId}`);
  return actionOk(undefined);
}

export async function updatePoShipment(
  purchaseId: string,
  data: { transporter?: string; shipmentStatus?: ShipmentStatus; expectedDelivery?: string },
): Promise<ActionResult> {
  await requirePermission("purchases.edit");
  await prisma.purchase.update({
    where: { id: purchaseId },
    data: {
      transporter: data.transporter ?? undefined,
      shipmentStatus: data.shipmentStatus ?? undefined,
      expectedDelivery: data.expectedDelivery ? new Date(data.expectedDelivery) : undefined,
    },
  });
  await syncPoLifecycle(purchaseId);
  revalidatePath(`/purchases/${purchaseId}`);
  return actionOk(undefined);
}

export async function receivePurchaseGoods(
  purchaseId: string,
  partialPct = 100,
): Promise<ActionResult> {
  const { receivePurchaseGoodsEnterprise } = await import("@/actions/grn");
  return receivePurchaseGoodsEnterprise(purchaseId, partialPct);
}

export async function recordPoBill(purchaseId: string, billUrl?: string): Promise<ActionResult> {
  const result = await recordBill(purchaseId, billUrl);
  if (!result.ok) return result;
  await prisma.purchase.update({
    where: { id: purchaseId },
    data: { poStatus: "BILLED" },
  });
  await logPoEvent(purchaseId, "BILLED", "Vendor bill recorded");
  await syncPoLifecycle(purchaseId);
  revalidatePath(`/purchases/${purchaseId}`);
  return actionOk(undefined);
}

export async function markPoPaid(purchaseId: string): Promise<ActionResult> {
  await requirePermission("purchases.edit");
  await prisma.purchase.update({
    where: { id: purchaseId },
    data: { paymentStatus: "PAID", poStatus: "PAID", procurementStage: "PAID" },
  });
  await logPoEvent(purchaseId, "PAID", "Payment completed");
  await syncPoLifecycle(purchaseId);
  revalidatePath(`/purchases/${purchaseId}`);
  revalidatePath("/purchases");
  return actionOk(undefined);
}

export async function cancelPurchaseOrder(purchaseId: string): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  await prisma.purchase.update({
    where: { id: purchaseId },
    data: { poStatus: "CANCELLED", procurementStage: "CANCELLED", paymentStatus: "CANCELLED" },
  });
  await logPoEvent(purchaseId, "CANCELLED", "PO cancelled", { userId: user.id });
  revalidatePath(`/purchases/${purchaseId}`);
  revalidatePath("/purchases");
  return actionOk(undefined);
}

export { approvePurchaseLevel, recordBill };
