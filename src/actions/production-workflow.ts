"use server";

import { revalidatePath } from "next/cache";
import type { ProductionStage, ProductionStatus } from "@prisma/client";
import { actionOk, type ActionResult } from "@/lib/action-result";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import {
  computeShortage,
  computeYieldPct,
  explodeBom,
  generateBatchCode,
  generateWorkOrderNumber,
  nextStage,
} from "@/lib/production-engine";
import { STAGE_ORDER } from "@/lib/production-types";

function revalidateProduction(paths?: string[]) {
  revalidatePath("/production");
  revalidatePath("/production/schedule");
  for (const p of paths ?? []) revalidatePath(p);
}

async function audit(input: {
  batchId?: string;
  action: import("@prisma/client").ProductionAuditAction;
  title: string;
  detail?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}) {
  const delegate = (prisma as unknown as Record<string, { create?: (args: unknown) => Promise<unknown> }>).productionAuditLog;
  if (!delegate?.create) return;
  await delegate.create({
    data: {
      batchId: input.batchId ?? null,
      action: input.action,
      title: input.title,
      detail: input.detail ?? null,
      actorId: input.actorId ?? null,
      metadata: input.metadata ?? {},
    },
  });
}

export async function createProductionOrder(input: {
  recipeId: string;
  branchId?: string;
  machineId?: string;
  shiftId?: string;
  plannedQty: number;
  scheduledStart: string;
  scheduledEnd: string;
}): Promise<ActionResult<{ batchId: string; workOrderId: string }>> {
  const user = await requirePermission("production.manage");

  const recipe = await prisma.recipe.findUnique({
    where: { id: input.recipeId },
    include: { lines: true },
  });
  if (!recipe) return { ok: false, error: "Recipe not found" };

  const batchCount = await prisma.productionBatch.count();
  const woCount = await prisma.productionWorkOrder.count();
  const batchCode = generateBatchCode(batchCount + 1);
  const orderNumber = generateWorkOrderNumber(woCount + 1);

  const start = new Date(input.scheduledStart);
  const end = new Date(input.scheduledEnd);

  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.productionBatch.create({
      data: {
        batchCode,
        recipeId: input.recipeId,
        branchId: input.branchId ?? null,
        machineId: input.machineId ?? null,
        shiftId: input.shiftId ?? null,
        status: "PLANNED",
        plannedQty: input.plannedQty,
        expectedYieldPct: recipe.expectedYieldPct,
        scheduledStart: start,
        scheduledEnd: end,
      },
    });

    const wo = await tx.productionWorkOrder.create({
      data: {
        orderNumber,
        recipeId: input.recipeId,
        branchId: input.branchId ?? null,
        machineId: input.machineId ?? null,
        batchId: batch.id,
        plannedQty: input.plannedQty,
        plannedStart: start,
        plannedEnd: end,
        status: "PLANNED",
      },
    });

    await tx.productionScheduleSlot.create({
      data: {
        batchId: batch.id,
        machineId: input.machineId ?? null,
        shiftId: input.shiftId ?? null,
        scheduledStart: start,
        scheduledEnd: end,
        ganttRow: input.machineId ? 1 : 0,
      },
    });

    const exploded = explodeBom(
      recipe.lines.map((l) => ({ productId: l.productId, quantity: Number(l.quantity), unit: l.unit, scrapPct: Number(l.scrapPct) })),
      input.plannedQty,
      Number(recipe.yieldQty),
    );

    for (const req of exploded) {
      const product = await tx.product.findUnique({ where: { id: req.productId }, include: { reservations: { where: { releasedAt: null } } } });
      const available = product ? Number(product.stockQty) - product.reservations.reduce((s, r) => s + Number(r.quantity), 0) : 0;
      const shortage = computeShortage(req.requiredQty, available);
      await tx.productionMaterialRequirement.create({
        data: {
          batchId: batch.id,
          workOrderId: wo.id,
          productId: req.productId,
          requiredQty: req.requiredQty,
          allocatedQty: Math.min(req.requiredQty, available),
          shortageQty: shortage,
          unit: req.unit,
        },
      });
      if (shortage > 0) {
        await tx.productionAlert.create({
          data: {
            batchId: batch.id,
            branchId: input.branchId ?? null,
            alertType: "MATERIAL_SHORTAGE",
            severity: "WARNING",
            title: `Material shortage for ${batchCode}`,
            message: `${req.productId}: short ${shortage} ${req.unit}`,
          },
        });
      }
    }

    return { batch, wo };
  });

  await audit({
    batchId: result.batch.id,
    action: "ORDER_CREATED",
    title: `Production order ${batchCode} created`,
    actorId: user.id,
  });

  revalidateProduction([`/production/batches/${result.batch.id}`]);
  return actionOk({ batchId: result.batch.id, workOrderId: result.wo.id });
}

export async function releaseProductionOrder(batchId: string): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("production.manage");
  const batch = await prisma.productionBatch.update({
    where: { id: batchId },
    data: { status: "RELEASED", releasedAt: new Date(), currentStage: STAGE_ORDER[0] },
  });
  await prisma.productionWorkOrder.updateMany({
    where: { batchId },
    data: { status: "RELEASED", releasedAt: new Date() },
  });
  await audit({ batchId, action: "ORDER_RELEASED", title: `Batch ${batch.batchCode} released`, actorId: user.id });
  revalidateProduction([`/production/batches/${batchId}`]);
  return actionOk({ id: batchId });
}

export async function startProductionStage(batchId: string, stage: ProductionStage): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("production.manage");
  await prisma.productionStageEvent.create({
    data: { batchId, stage, operatorId: user.id },
  });
  await prisma.productionBatch.update({
    where: { id: batchId },
    data: { status: "IN_PROGRESS", currentStage: stage, startedAt: new Date() },
  });
  await audit({ batchId, action: "STAGE_STARTED", title: `Stage ${stage} started`, actorId: user.id });
  revalidateProduction([`/production/batches/${batchId}`]);
  return actionOk({ id: batchId });
}

export async function completeProductionStage(
  batchId: string,
  stage: ProductionStage,
  outputQty?: number,
): Promise<ActionResult<{ id: string; nextStage: ProductionStage | null }>> {
  const user = await requirePermission("production.manage");
  await prisma.productionStageEvent.updateMany({
    where: { batchId, stage, completedAt: null },
    data: { completedAt: new Date(), outputQty: outputQty ?? null },
  });

  const nxt = nextStage(stage);
  const batch = await prisma.productionBatch.findUnique({ where: { id: batchId } });
  if (!batch) return { ok: false, error: "Batch not found" };

  if (nxt) {
    await prisma.productionBatch.update({ where: { id: batchId }, data: { currentStage: nxt } });
  } else {
    await prisma.productionBatch.update({
      where: { id: batchId },
      data: { status: "QC", qcAt: new Date(), currentStage: "PACKING" },
    });
  }

  await audit({ batchId, action: "STAGE_COMPLETED", title: `Stage ${stage} completed`, actorId: user.id });
  revalidateProduction([`/production/batches/${batchId}`]);
  return actionOk({ id: batchId, nextStage: nxt });
}

export async function submitBatchQc(batchId: string, passed: boolean): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("production.manage");
  const batch = await prisma.productionBatch.findUnique({ where: { id: batchId }, include: { recipe: true } });
  if (!batch) return { ok: false, error: "Batch not found" };

  const actualQty = batch.actualQty != null ? Number(batch.actualQty) : Number(batch.plannedQty) * 0.94;
  const yieldPct = computeYieldPct(actualQty, Number(batch.plannedQty));

  await prisma.productionBatch.update({
    where: { id: batchId },
    data: passed
      ? { status: "COMPLETED", completedAt: new Date(), actualQty, actualYieldPct: yieldPct }
      : { status: "REJECTED", rejectedAt: new Date(), actualYieldPct: yieldPct },
  });

  if (!passed) {
    await prisma.productionAlert.create({
      data: {
        batchId,
        alertType: "QC_FAILURE",
        severity: "CRITICAL",
        title: `QC failed — ${batch.batchCode}`,
      },
    });
  }

  await audit({
    batchId,
    action: passed ? "QC_PASSED" : "QC_FAILED",
    title: passed ? "QC passed" : "QC failed",
    actorId: user.id,
  });

  revalidateProduction([`/production/batches/${batchId}`]);
  return actionOk({ id: batchId });
}

export async function updateScheduleSlot(input: {
  slotId: string;
  scheduledStart: string;
  scheduledEnd: string;
  machineId?: string | null;
  ganttRow?: number;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("production.manage");
  const slot = await prisma.productionScheduleSlot.update({
    where: { id: input.slotId },
    data: {
      scheduledStart: new Date(input.scheduledStart),
      scheduledEnd: new Date(input.scheduledEnd),
      machineId: input.machineId ?? null,
      ganttRow: input.ganttRow ?? 0,
    },
  });

  await prisma.productionBatch.update({
    where: { id: slot.batchId },
    data: {
      scheduledStart: new Date(input.scheduledStart),
      scheduledEnd: new Date(input.scheduledEnd),
      machineId: input.machineId ?? undefined,
    },
  });

  await audit({
    batchId: slot.batchId,
    action: "SCHEDULE_UPDATED",
    title: "Schedule updated via Gantt",
    actorId: user.id,
  });

  revalidateProduction(["/production/schedule"]);
  return actionOk({ id: input.slotId });
}

export async function runProductionOptimization(branchId?: string): Promise<ActionResult<{ score: number }>> {
  const user = await requirePermission("production.manage");
  const machines = await prisma.productionMachine.findMany({ where: branchId ? { branchId } : {} });
  const shortages = await prisma.productionAlert.count({ where: { alertType: "MATERIAL_SHORTAGE", resolved: false } });
  const delayed = await prisma.productionBatch.count({
    where: {
      status: { in: ["PLANNED", "RELEASED", "IN_PROGRESS"] },
      scheduledEnd: { lt: new Date() },
    },
  });
  const util = machines.length ? machines.filter((m) => m.status === "ACTIVE").length / machines.length : 0.5;
  const score = Math.min(100, Math.round(util * 50 + shortages * 8 + delayed * 12));

  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  await prisma.productionForecastPoint.create({
    data: {
      branchId: branchId ?? null,
      periodYear: year,
      periodMonth: month,
      throughputForecast: 1000,
      bottleneckScore: score,
      aiOptimizedQty: 1000 * (1 + score / 200),
    },
  }).catch(() => undefined);

  if (score > 70) {
    await prisma.productionAlert.create({
      data: {
        branchId: branchId ?? null,
        alertType: "BOTTLENECK",
        severity: "WARNING",
        title: "AI bottleneck prediction — capacity constraint",
        message: `Bottleneck score ${score}/100`,
      },
    });
  }

  await audit({ action: "COMPLIANCE", title: "AI production optimization run", actorId: user.id, metadata: { score } });
  revalidateProduction();
  return actionOk({ score });
}

export async function advanceBatchStatus(batchId: string, status: ProductionStatus): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("production.manage");
  await prisma.productionBatch.update({ where: { id: batchId }, data: { status } });
  await audit({ batchId, action: "BATCH_COMPLETED", title: `Status → ${status}`, actorId: user.id });
  revalidateProduction([`/production/batches/${batchId}`]);
  return actionOk({ id: batchId });
}
