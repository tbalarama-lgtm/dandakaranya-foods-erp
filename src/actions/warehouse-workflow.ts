"use server";

import { revalidatePath } from "next/cache";
import type { WarehouseStaffRole, WarehouseTaskType } from "@prisma/client";
import { actionOk, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import {
  aiOptimizeReplenishment,
  forecastReplenishment,
  generateDispatchNumber,
  generateDockAppointmentNo,
  generateTransferNumber,
} from "@/lib/warehouse-engine";

function revalidateWarehouse(paths?: string[]) {
  revalidatePath("/warehouses");
  revalidatePath("/branches");
  revalidatePath("/inventory");
  for (const p of paths ?? []) revalidatePath(p);
}

async function audit(input: {
  warehouseId?: string;
  action: import("@prisma/client").WarehouseAuditAction;
  title: string;
  detail?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}) {
  const delegate = (prisma as unknown as Record<string, { create?: (args: unknown) => Promise<unknown> }>)
    .warehouseAuditLog;
  if (!delegate?.create) return;
  await delegate.create({
    data: {
      warehouseId: input.warehouseId ?? null,
      action: input.action,
      title: input.title,
      detail: input.detail ?? null,
      actorId: input.actorId ?? null,
      metadata: input.metadata ?? {},
    },
  });
}

export async function createTransferRequest(input: {
  fromWarehouseId: string;
  toWarehouseId: string;
  items: { productId: string; quantity: number; batchId?: string }[];
  notes?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");
  if (input.fromWarehouseId === input.toWarehouseId) {
    return { ok: false, error: "Source and destination must differ" };
  }

  const count = await prisma.warehouseTransfer.count();
  const transferNumber = generateTransferNumber(count + 1);

  const transfer = await prisma.warehouseTransfer.create({
    data: {
      transferNumber,
      fromWarehouseId: input.fromWarehouseId,
      toWarehouseId: input.toWarehouseId,
      status: "PENDING_APPROVAL",
      initiatedById: user.id,
      notes: input.notes ?? null,
      items: {
        create: input.items.map((i) => ({
          productId: i.productId,
          batchId: i.batchId ?? null,
          quantity: i.quantity,
        })),
      },
    },
  });

  await audit({
    warehouseId: input.fromWarehouseId,
    action: "TRANSFER_REQUEST",
    title: `Transfer ${transferNumber} submitted`,
    actorId: user.id,
    metadata: { transferId: transfer.id },
  });

  revalidateWarehouse(["/warehouses/transfers"]);
  return actionOk({ id: transfer.id });
}

export async function approveTransfer(
  transferId: string,
  approve: boolean,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");
  const transfer = await prisma.warehouseTransfer.findUnique({ where: { id: transferId } });
  if (!transfer) return { ok: false, error: "Transfer not found" };

  await prisma.warehouseTransfer.update({
    where: { id: transferId },
    data: approve
      ? { status: "APPROVED", approvedById: user.id, approvedAt: new Date() }
      : { status: "CANCELLED" },
  });

  await audit({
    warehouseId: transfer.fromWarehouseId,
    action: approve ? "TRANSFER_APPROVED" : "UPDATED",
    title: approve ? `Transfer ${transfer.transferNumber} approved` : `Transfer ${transfer.transferNumber} cancelled`,
    actorId: user.id,
  });

  revalidateWarehouse(["/warehouses/transfers"]);
  return actionOk({ id: transferId });
}

export async function shipTransfer(input: {
  transferId: string;
  transporterName?: string;
  vehicleNumber?: string;
  lrNumber?: string;
  trackingUrl?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");
  const transfer = await prisma.warehouseTransfer.findUnique({
    where: { id: input.transferId },
    include: { items: true },
  });
  if (!transfer) return { ok: false, error: "Transfer not found" };
  if (!["APPROVED", "DRAFT"].includes(transfer.status)) {
    return { ok: false, error: "Transfer not ready to ship" };
  }

  await prisma.$transaction([
    prisma.warehouseTransfer.update({
      where: { id: input.transferId },
      data: {
        status: "IN_TRANSIT",
        shippedAt: new Date(),
        transporterName: input.transporterName ?? null,
        vehicleNumber: input.vehicleNumber ?? null,
        lrNumber: input.lrNumber ?? null,
        trackingUrl: input.trackingUrl ?? null,
      },
    }),
    ...transfer.items.map((item) =>
      prisma.stockMovement.create({
        data: {
          productId: item.productId,
          fromWarehouseId: transfer.fromWarehouseId,
          toWarehouseId: transfer.toWarehouseId,
          type: "TRANSFER_OUT",
          quantity: item.quantity,
          reference: transfer.transferNumber,
          referenceType: "TRANSFER",
          referenceId: transfer.id,
          userId: user.id,
        },
      }),
    ),
  ]);

  await audit({
    warehouseId: transfer.fromWarehouseId,
    action: "TRANSFER_SHIPPED",
    title: `Transfer ${transfer.transferNumber} shipped`,
    actorId: user.id,
    metadata: { lrNumber: input.lrNumber },
  });

  revalidateWarehouse(["/warehouses/transfers"]);
  return actionOk({ id: input.transferId });
}

export async function receiveTransfer(transferId: string): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");
  const transfer = await prisma.warehouseTransfer.findUnique({
    where: { id: transferId },
    include: { items: true },
  });
  if (!transfer) return { ok: false, error: "Transfer not found" };

  await prisma.$transaction([
    prisma.warehouseTransfer.update({
      where: { id: transferId },
      data: { status: "RECEIVED", receivedAt: new Date(), actualArrival: new Date() },
    }),
    ...transfer.items.map((item) =>
      prisma.stockMovement.create({
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
      }),
    ),
  ]);

  await audit({
    warehouseId: transfer.toWarehouseId,
    action: "TRANSFER_RECEIVED",
    title: `Transfer ${transfer.transferNumber} received`,
    actorId: user.id,
  });

  revalidateWarehouse(["/warehouses/transfers"]);
  return actionOk({ id: transferId });
}

export async function createDispatchOrder(input: {
  warehouseId: string;
  lines: { productId: string; quantity: number; batchId?: string }[];
  notes?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");
  const count = await prisma.pickPackDispatch.count();
  const dispatchNumber = generateDispatchNumber(count + 1);

  const dispatch = await prisma.pickPackDispatch.create({
    data: {
      dispatchNumber,
      warehouseId: input.warehouseId,
      status: "PENDING",
      notes: input.notes ?? null,
      lines: {
        create: input.lines.map((l) => ({
          productId: l.productId,
          batchId: l.batchId ?? null,
          quantity: l.quantity,
        })),
      },
    },
  });

  await audit({
    warehouseId: input.warehouseId,
    action: "DISPATCH",
    title: `Dispatch ${dispatchNumber} created`,
    actorId: user.id,
  });

  revalidateWarehouse(["/warehouses/dispatch"]);
  return actionOk({ id: dispatch.id });
}

export async function advanceDispatchStatus(
  dispatchId: string,
  status: import("@prisma/client").PickPackStatus,
  input?: { transporterName?: string; lrNumber?: string; vehicleNumber?: string; dockBay?: string },
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");
  const data: Record<string, unknown> = { status };
  if (status === "PICKING") data.pickedAt = new Date();
  if (status === "PACKED") data.packedAt = new Date();
  if (status === "DISPATCHED") data.dispatchedAt = new Date();
  if (status === "DELIVERED") data.deliveredAt = new Date();
  if (input?.transporterName) data.transporterName = input.transporterName;
  if (input?.lrNumber) data.lrNumber = input.lrNumber;
  if (input?.vehicleNumber) data.vehicleNumber = input.vehicleNumber;
  if (input?.dockBay) data.dockBay = input.dockBay;

  const dispatch = await prisma.pickPackDispatch.update({
    where: { id: dispatchId },
    data,
  });

  await audit({
    warehouseId: dispatch.warehouseId ?? undefined,
    action: "DISPATCH",
    title: `Dispatch ${dispatch.dispatchNumber} → ${status}`,
    actorId: user.id,
  });

  revalidateWarehouse(["/warehouses/dispatch"]);
  return actionOk({ id: dispatchId });
}

export async function createWarehouseTask(input: {
  warehouseId: string;
  taskType: WarehouseTaskType;
  title: string;
  binId?: string;
  assignedToId?: string;
  priority?: number;
  dueAt?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");

  const task = await prisma.warehouseTask.create({
    data: {
      warehouseId: input.warehouseId,
      taskType: input.taskType,
      title: input.title,
      binId: input.binId ?? null,
      assignedToId: input.assignedToId ?? null,
      priority: input.priority ?? 3,
      dueAt: input.dueAt ? new Date(input.dueAt) : null,
      status: input.assignedToId ? "ASSIGNED" : "OPEN",
    },
  });

  revalidateWarehouse([`/warehouses/${input.warehouseId}`]);
  return actionOk({ id: task.id });
}

export async function completeWarehouseTask(taskId: string): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");
  const task = await prisma.warehouseTask.update({
    where: { id: taskId },
    data: { status: "COMPLETED", completedAt: new Date() },
  });

  await audit({
    warehouseId: task.warehouseId,
    action: "TASK_COMPLETED",
    title: `Task completed: ${task.title}`,
    actorId: user.id,
  });

  revalidateWarehouse([`/warehouses/${task.warehouseId}`]);
  return actionOk({ id: taskId });
}

export async function assignWarehouseStaff(input: {
  warehouseId: string;
  userId: string;
  staffRole: WarehouseStaffRole;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");

  const assignment = await prisma.warehouseStaffAssignment.upsert({
    where: {
      warehouseId_userId_staffRole: {
        warehouseId: input.warehouseId,
        userId: input.userId,
        staffRole: input.staffRole,
      },
    },
    create: {
      warehouseId: input.warehouseId,
      userId: input.userId,
      staffRole: input.staffRole,
    },
    update: { active: true },
  });

  await audit({
    warehouseId: input.warehouseId,
    action: "STAFF_ASSIGNED",
    title: `Staff assigned (${input.staffRole})`,
    actorId: user.id,
  });

  revalidateWarehouse([`/warehouses/${input.warehouseId}`]);
  return actionOk({ id: assignment.id });
}

export async function scheduleDockAppointment(input: {
  warehouseId: string;
  dockBay: string;
  scheduledAt: string;
  carrierName?: string;
  vehicleNumber?: string;
  lrNumber?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");
  const count = await prisma.dockAppointment.count();
  const appointmentNo = generateDockAppointmentNo(count + 1);

  const appt = await prisma.dockAppointment.create({
    data: {
      appointmentNo,
      warehouseId: input.warehouseId,
      dockBay: input.dockBay,
      scheduledAt: new Date(input.scheduledAt),
      carrierName: input.carrierName ?? null,
      vehicleNumber: input.vehicleNumber ?? null,
      lrNumber: input.lrNumber ?? null,
    },
  });

  revalidateWarehouse([`/warehouses/${input.warehouseId}`]);
  return actionOk({ id: appt.id });
}

export async function runWarehouseForecast(warehouseId: string): Promise<ActionResult<{ points: number }>> {
  const user = await requirePermission("inventory.edit");
  const products = await prisma.product.findMany({
    where: { warehouseId, active: true },
    take: 20,
  });
  const warehouse = await prisma.warehouse.findUnique({ where: { id: warehouseId } });
  if (!warehouse) return { ok: false, error: "Warehouse not found" };

  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const utilizationPct =
    Number(warehouse.storageCapacityKg) > 0
      ? (Number(warehouse.storageUsedKg) / Number(warehouse.storageCapacityKg)) * 100
      : 50;

  let points = 0;
  for (const p of products) {
    const demand = Number(p.reorderPoint) * 1.2;
    const replenishment = forecastReplenishment(demand, Number(p.stockQty), Number(p.safetyStockQty));
    const aiQty = aiOptimizeReplenishment(demand, Number(p.stockQty), Number(p.safetyStockQty), utilizationPct);

    await prisma.warehouseForecastPoint.upsert({
      where: {
        warehouseId_productId_periodYear_periodMonth: {
          warehouseId,
          productId: p.id,
          periodYear: year,
          periodMonth: month,
        },
      },
      create: {
        warehouseId,
        productId: p.id,
        periodYear: year,
        periodMonth: month,
        demandForecast: demand,
        replenishmentQty: replenishment,
        aiOptimizedQty: aiQty,
        utilizationPct,
      },
      update: {
        demandForecast: demand,
        replenishmentQty: replenishment,
        aiOptimizedQty: aiQty,
        utilizationPct,
      },
    });
    points += 1;
  }

  await audit({
    warehouseId,
    action: "UPDATED",
    title: "AI replenishment forecast generated",
    actorId: user.id,
    metadata: { points },
  });

  revalidateWarehouse([`/warehouses/${warehouseId}`]);
  return actionOk({ points });
}

export async function recordEnvironmentalReading(input: {
  warehouseId: string;
  temperatureC?: number;
  humidityPct?: number;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("inventory.edit");
  const warehouse = await prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
  if (!warehouse) return { ok: false, error: "Warehouse not found" };

  const tempMin = warehouse.tempMinC != null ? Number(warehouse.tempMinC) : null;
  const tempMax = warehouse.tempMaxC != null ? Number(warehouse.tempMaxC) : null;
  const humMin = warehouse.humidityMinPct != null ? Number(warehouse.humidityMinPct) : null;
  const humMax = warehouse.humidityMaxPct != null ? Number(warehouse.humidityMaxPct) : null;

  const inRange =
    (input.temperatureC == null || ((tempMin == null || input.temperatureC >= tempMin) && (tempMax == null || input.temperatureC <= tempMax))) &&
    (input.humidityPct == null || ((humMin == null || input.humidityPct >= humMin) && (humMax == null || input.humidityPct <= humMax)));

  const reading = await prisma.warehouseEnvironmentalReading.create({
    data: {
      warehouseId: input.warehouseId,
      temperatureC: input.temperatureC ?? null,
      humidityPct: input.humidityPct ?? null,
      inRange,
      alertTriggered: !inRange,
    },
  });

  if (!inRange) {
    await audit({
      warehouseId: input.warehouseId,
      action: "ENVIRONMENT_ALERT",
      title: "Cold storage environment out of range",
      actorId: user.id,
    });
  }

  revalidateWarehouse([`/warehouses/${input.warehouseId}`]);
  return actionOk({ id: reading.id });
}
