"use server";

import { revalidatePath } from "next/cache";
import type {
  AdjustmentReasonCode,
  InventoryReservationPurpose,
  StockMovementType,
} from "@prisma/client";
import { actionOk, type ActionResult } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { shouldTriggerReorder } from "@/lib/inventory-engine";
import { prisma } from "@/lib/db";
import { upsertNotification } from "@/lib/notifications";
import { requirePermission } from "@/lib/session";

function revalidateInventory(productId?: string) {
  revalidatePath("/inventory");
  revalidatePath("/products");
  if (productId) revalidatePath(`/inventory/${productId}`);
}

async function recordAudit(input: {
  productId?: string;
  batchId?: string;
  action: import("@prisma/client").InventoryAuditAction;
  title: string;
  detail?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}) {
  const delegate = (prisma as unknown as Record<string, { create?: (args: unknown) => Promise<unknown> }>).inventoryAuditLog;
  if (!delegate?.create) return;
  await delegate.create({
    data: {
      productId: input.productId ?? null,
      batchId: input.batchId ?? null,
      action: input.action,
      title: input.title,
      detail: input.detail ?? null,
      actorId: input.actorId ?? null,
      metadata: input.metadata ?? {},
    },
  });
}

export async function createInventoryAdjustment(input: {
  productId: string;
  quantity: number;
  direction: StockMovementType;
  reasonCode: AdjustmentReasonCode;
  notes?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");

  const adj = await prisma.inventoryAdjustment.create({
    data: {
      productId: input.productId,
      quantity: input.quantity,
      direction: input.direction,
      reasonCode: input.reasonCode,
      notes: input.notes ?? null,
      status: "PENDING_APPROVAL",
      userId: user.id,
    },
  });

  await recordAudit({
    productId: input.productId,
    action: "ADJUSTMENT",
    title: "Adjustment submitted for approval",
    detail: input.notes,
    actorId: user.id,
    metadata: { adjustmentId: adj.id, reasonCode: input.reasonCode },
  });

  revalidateInventory(input.productId);
  return actionOk({ id: adj.id });
}

export async function approveInventoryAdjustment(
  adjustmentId: string,
  approve: boolean,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");
  const adj = await prisma.inventoryAdjustment.findUnique({
    where: { id: adjustmentId },
    include: { product: true },
  });
  if (!adj) return { ok: false, error: "Adjustment not found" };

  if (!approve) {
    await prisma.inventoryAdjustment.update({
      where: { id: adjustmentId },
      data: { status: "REJECTED", approvedById: user.id, approvedAt: new Date() },
    });
    revalidateInventory(adj.productId);
    return actionOk({ id: adjustmentId });
  }

  const qty = Number(adj.quantity);
  const delta = adj.direction === "OUT" ? -qty : qty;
  const newQty = Math.max(0, Number(adj.product.stockQty) + delta);

  await prisma.$transaction([
    prisma.inventoryAdjustment.update({
      where: { id: adjustmentId },
      data: { status: "POSTED", approvedById: user.id, approvedAt: new Date() },
    }),
    prisma.product.update({ where: { id: adj.productId }, data: { stockQty: newQty } }),
    prisma.stockMovement.create({
      data: {
        productId: adj.productId,
        warehouseId: adj.warehouseId,
        type: "ADJUSTMENT",
        quantity: qty,
        unit: adj.unit,
        reasonCode: adj.reasonCode,
        reference: `ADJ-${adjustmentId.slice(-8)}`,
        referenceType: "ADJUSTMENT",
        referenceId: adjustmentId,
        userId: user.id,
        notes: adj.notes,
      },
    }),
  ]);

  await recordAudit({
    productId: adj.productId,
    action: "ADJUSTMENT",
    title: "Adjustment posted",
    detail: adj.notes ?? undefined,
    actorId: user.id,
  });

  revalidateInventory(adj.productId);
  return actionOk({ id: adjustmentId });
}

export async function reserveInventory(input: {
  productId: string;
  quantity: number;
  purpose: InventoryReservationPurpose;
  referenceId?: string;
  batchId?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");
  const product = await prisma.product.findUnique({ where: { id: input.productId } });
  if (!product) return { ok: false, error: "Product not found" };

  const reservation = await prisma.inventoryReservation.create({
    data: {
      productId: input.productId,
      batchId: input.batchId ?? null,
      warehouseId: product.warehouseId,
      purpose: input.purpose,
      referenceId: input.referenceId ?? null,
      quantity: input.quantity,
      unit: product.unit,
      userId: user.id,
    },
  });

  await recordAudit({
    productId: input.productId,
    action: "RESERVATION",
    title: `Stock reserved for ${input.purpose}`,
    actorId: user.id,
    metadata: { quantity: input.quantity },
  });

  revalidateInventory(input.productId);
  return actionOk({ id: reservation.id });
}

export async function createWarehouseTransfer(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  items: { productId: string; quantity: number; batchId?: string }[];
  notes?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");
  const count = await prisma.warehouseTransfer.count();
  const transferNumber = `WT-${new Date().getFullYear()}-${String(count + 1).padStart(4, "0")}`;

  const transfer = await prisma.warehouseTransfer.create({
    data: {
      transferNumber,
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      status: "IN_TRANSIT",
      initiatedById: user.id,
      notes: input.notes ?? null,
      shippedAt: new Date(),
      items: {
        create: input.items.map((i) => ({
          productId: i.productId,
          batchId: i.batchId ?? null,
          quantity: i.quantity,
        })),
      },
    },
  });

  for (const item of input.items) {
    await prisma.stockMovement.create({
      data: {
        productId: item.productId,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        type: "TRANSFER_OUT",
        quantity: item.quantity,
        reference: transferNumber,
        referenceType: "TRANSFER",
        referenceId: transfer.id,
        userId: user.id,
      },
    });
  }

  await recordAudit({
    action: "TRANSFER",
    title: `Transfer ${transferNumber} in transit`,
    actorId: user.id,
    metadata: { transferId: transfer.id },
  });

  revalidatePath("/inventory");
  return actionOk({ id: transfer.id });
}

export async function receiveWarehouseTransfer(transferId: string): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");
  const transfer = await prisma.warehouseTransfer.findUnique({
    where: { id: transferId },
    include: { items: true },
  });
  if (!transfer) return { ok: false, error: "Transfer not found" };

  await prisma.warehouseTransfer.update({
    where: { id: transferId },
    data: { status: "RECEIVED", receivedAt: new Date() },
  });

  for (const item of transfer.items) {
    await prisma.stockMovement.create({
      data: {
        productId: item.productId,
        warehouseId: transfer.toWarehouseId,
        type: "TRANSFER_IN",
        quantity: item.quantity,
        reference: transfer.transferNumber,
        referenceType: "TRANSFER",
        referenceId: transferId,
        userId: user.id,
      },
    });
  }

  await recordAudit({
    action: "TRANSFER",
    title: `Transfer ${transfer.transferNumber} received`,
    actorId: user.id,
  });

  revalidatePath("/inventory");
  return actionOk({ id: transferId });
}

export async function checkReorderAlerts(): Promise<ActionResult<{ triggered: number }>> {
  const products = await prisma.product.findMany({ where: { active: true }, include: { reservations: { where: { releasedAt: null } } } });
  let triggered = 0;
  const admins = await prisma.user.findMany({ where: { role: { in: ["ADMIN", "MANAGER"] }, active: true }, select: { id: true }, take: 5 });

  for (const p of products) {
    const reserved = p.reservations.reduce((s, r) => s + Number(r.quantity), 0);
    const available = Number(p.stockQty) - reserved;
    if (shouldTriggerReorder(available, Number(p.reorderPoint ?? p.minStockQty), Number(p.safetyStockQty ?? p.minStockQty))) {
      triggered += 1;
      for (const u of admins) {
        await upsertNotification({
          userId: u.id,
          title: "Reorder alert",
          message: `${p.name} (${p.sku}) below reorder point — ${available} ${p.unit} available`,
          category: "INVENTORY",
          severity: "WARNING",
          link: `/inventory/${p.id}`,
          entityType: "Product",
          entityId: p.id,
          ruleKey: `reorder-${p.id}`,
        });
      }
      await recordAudit({ productId: p.id, action: "REORDER_TRIGGER", title: "Reorder point breached" });
    }
  }

  return actionOk({ triggered });
}

/** Backward-compatible quick adjust */
export async function adjustStock(
  productId: string,
  quantity: number,
  type: StockMovementType,
  notes?: string,
) {
  const user = await requirePermission("inventory.edit");
  const product = await prisma.product.findUniqueOrThrow({ where: { id: productId } });
  const delta = type === "OUT" ? -quantity : quantity;
  const newQty = Number(product.stockQty) + delta;

  await prisma.$transaction([
    prisma.product.update({ where: { id: productId }, data: { stockQty: Math.max(0, newQty) } }),
    prisma.stockMovement.create({
      data: {
        productId,
        warehouseId: product.warehouseId,
        type,
        quantity,
        unit: product.unit,
        notes,
        reference: `ADJ-${Date.now()}`,
        userId: user.id,
      },
    }),
  ]);

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entityType: "Product",
    entityId: productId,
    message: `Stock ${type}: ${product.name} (${quantity} ${product.unit})`,
  });

  revalidateInventory(productId);
}

export { toggleProductActive } from "@/actions/inventory-legacy";
