import type { ProductionAuditAction, ProductionStage, ProductionStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pingDatabase } from "@/lib/db-connection";
import {
  computeOee,
  computeShortage,
  explodeBom,
  isBatchDelayed,
  predictBottleneckScore,
} from "@/lib/production-engine";
import type {
  BatchGovernanceRow,
  GanttSlot,
  MachineRow,
  MaterialCatalogRow,
  MrpLine,
  ProductionAlertRow,
  ProductionBatchDetail,
  ProductionHubBundle,
  ProductionHubKpis,
  QcGovernanceRow,
  WorkOrderGovernanceRow,
} from "@/lib/production-types";
import { STAGE_LABELS } from "@/lib/production-types";
import { safeQuery } from "@/lib/prisma-safe";

function n(v: unknown): number {
  if (v == null) return 0;
  return Number(v);
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

export async function getProductionHubBundle(branchId?: string): Promise<ProductionHubBundle> {
  if (!(await pingDatabase())) return emptyHub();

  const batchWhere = branchId ? { branchId } : {};

  const [batches, slots, machines, alerts, audit, branches, oeeSnaps, logsToday, products, workOrders, complianceLogs, consumptionToday] =
    await Promise.all([
    safeQuery(
      () =>
        prisma.productionBatch.findMany({
          where: batchWhere,
          include: {
            recipe: { include: { outputProduct: { select: { name: true } }, lines: { include: { product: true } } } },
            branch: { select: { name: true } },
            machine: { select: { name: true } },
            shift: { select: { name: true } },
          },
          orderBy: [{ scheduledStart: "asc" }, { createdAt: "desc" }],
          take: 50,
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.productionScheduleSlot.findMany({
          include: {
            batch: {
              include: { recipe: { include: { outputProduct: { select: { name: true } } } } },
            },
            machine: { select: { id: true, name: true } },
            shift: { select: { id: true, name: true } },
          },
          orderBy: { scheduledStart: "asc" },
          take: 40,
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.productionMachine.findMany({
          where: branchId ? { branchId } : {},
          include: {
            branch: { select: { name: true } },
            oeeSnapshots: { orderBy: { snapshotDate: "desc" }, take: 1 },
          },
          orderBy: { name: "asc" },
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.productionAlert.findMany({
          include: { batch: { select: { batchCode: true } } },
          orderBy: { createdAt: "desc" },
          take: 30,
        }),
      [],
    ),
    safeQuery(
      () => prisma.productionAuditLog.findMany({ orderBy: { createdAt: "desc" }, take: 10 }),
      [],
    ),
    safeQuery(() => prisma.branch.findMany({ where: { isActive: true }, select: { id: true, name: true, code: true } }), []),
    safeQuery(
      () =>
        prisma.productionOeeSnapshot.findMany({
          orderBy: { snapshotDate: "desc" },
          take: 7,
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.productionLog.findMany({
          where: { logDate: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
          select: { outputQty: true },
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.product.findMany({
          where: { active: true },
          select: {
            id: true,
            sku: true,
            name: true,
            stockQty: true,
            unit: true,
            costPrice: true,
            reorderPoint: true,
            inventoryClass: true,
            warehouse: { select: { name: true } },
            reservations: { where: { releasedAt: null }, select: { quantity: true } },
          },
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.productionWorkOrder.findMany({
          where: branchId ? { branchId } : {},
          include: {
            recipe: { include: { outputProduct: { select: { name: true } } } },
            batch: {
              select: {
                batchCode: true,
                shift: { select: { name: true } },
                materialRequirements: { select: { allocatedQty: true, requiredQty: true } },
              },
            },
          },
          orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
          take: 40,
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.productionComplianceLog.findMany({
          include: {
            batch: { include: { recipe: { include: { outputProduct: { select: { name: true } } } } } },
            auditor: { select: { name: true } },
          },
          orderBy: { auditedAt: "desc" },
          take: 30,
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.productionMaterialRequirement.groupBy({
          by: ["productId"],
          where: {
            batch: {
              updatedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) },
            },
          },
          _sum: { allocatedQty: true },
        }),
      [],
    ),
  ]);

  const consumptionMap = new Map(consumptionToday.map((row) => [row.productId, n(row._sum.allocatedQty)]));

  const stockMap = new Map(
    products.map((p) => [
      p.id,
      {
        stockQty: n(p.stockQty),
        reserved: p.reservations.reduce((s, r) => s + n(r.quantity), 0),
      },
    ]),
  );

  const batchRows: BatchGovernanceRow[] = batches.map((b) => ({
    id: b.id,
    batchCode: b.batchCode,
    productName: b.recipe.outputProduct.name,
    recipeName: b.recipe.name,
    branchName: b.branch?.name ?? null,
    machineName: b.machine?.name ?? null,
    shiftName: b.shift?.name ?? null,
    status: b.status,
    currentStage: b.currentStage,
    plannedQty: n(b.plannedQty),
    actualQty: b.actualQty != null ? n(b.actualQty) : null,
    expectedYieldPct: n(b.expectedYieldPct),
    actualYieldPct: b.actualYieldPct != null ? n(b.actualYieldPct) : null,
    wastageQty: n(b.wastageQty),
    totalCost: n(b.totalCost),
    scheduledStart: iso(b.scheduledStart),
    scheduledEnd: iso(b.scheduledEnd),
    delayed: isBatchDelayed(b.scheduledEnd, b.status),
  }));

  const ganttSlots: GanttSlot[] = slots.map((s) => ({
    id: s.id,
    batchId: s.batchId,
    batchCode: s.batch.batchCode,
    productName: s.batch.recipe.outputProduct.name,
    machineId: s.machineId,
    machineName: s.machine?.name ?? null,
    shiftId: s.shiftId,
    shiftName: s.shift?.name ?? null,
    status: s.batch.status,
    scheduledStart: s.scheduledStart.toISOString(),
    scheduledEnd: s.scheduledEnd.toISOString(),
    ganttRow: s.ganttRow,
    sequenceOrder: s.sequenceOrder,
  }));

  const machineRows: MachineRow[] = machines.map((m) => {
    const snap = m.oeeSnapshots[0];
    const oee = snap ? n(snap.oee) : computeOee(85, 88, 92);
    const util = m.status === "ACTIVE" ? Math.min(95, 60 + n(m.throughputActual) / 10) : m.status === "IDLE" ? 20 : 0;
    return {
      id: m.id,
      code: m.code,
      name: m.name,
      line: m.line,
      branchName: m.branch?.name ?? null,
      status: m.status,
      utilizationPct: Math.round(util),
      throughputKg: n(m.throughputActual),
      downtimeHours: Math.round(n(m.downtimeMinutes) / 60 * 10) / 10,
      oee,
      lastMaintenance: iso(m.lastMaintenanceAt),
      nextMaintenance: iso(m.nextMaintenanceAt),
    };
  });

  const workOrderRows: WorkOrderGovernanceRow[] = workOrders.map((wo) => {
    const reqs = wo.batch?.materialRequirements ?? [];
    const materialAllocated =
      reqs.length > 0 && reqs.every((r) => n(r.allocatedQty) >= n(r.requiredQty) * 0.95);
    const progress =
      wo.status === "PLANNED"
        ? 0
        : wo.status === "RELEASED"
          ? 15
          : wo.status === "IN_PROGRESS"
            ? 55
            : wo.status === "QC"
              ? 85
              : wo.status === "COMPLETED" || wo.status === "REJECTED"
                ? 100
                : 0;

    return {
      id: wo.id,
      orderNumber: wo.orderNumber,
      productName: wo.recipe.outputProduct.name,
      batchCode: wo.batch?.batchCode ?? null,
      quantity: n(wo.plannedQty),
      priority: wo.priority,
      status: wo.status,
      assignedTeam: wo.batch?.shift?.name ?? null,
      materialAllocated,
      progress,
      notes: wo.notes,
    };
  });

  const qcInspections: QcGovernanceRow[] = complianceLogs
    .filter((log) => log.batch)
    .map((log) => ({
      id: log.id,
      batchCode: log.batch!.batchCode,
      productName: log.batch!.recipe.outputProduct.name,
      inspector: log.auditor?.name ?? null,
      auditedAt: log.auditedAt.toISOString(),
      passed: log.passed,
      standard: log.standard,
      notes: log.notes,
    }));

  const materialCatalog: MaterialCatalogRow[] = products
    .filter((p) => p.inventoryClass === "RAW_MATERIAL")
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      stockQty: n(p.stockQty),
      unit: p.unit,
      costPerUnit: n(p.costPrice),
      reorderLevel: n(p.reorderPoint),
      warehouseName: p.warehouse?.name ?? null,
      consumedToday: consumptionMap.get(p.id) ?? 0,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));

  const mrpAgg = new Map<string, MrpLine>();
  for (const b of batches.filter((x) => !["COMPLETED", "CANCELLED", "REJECTED"].includes(x.status))) {
    const exploded = explodeBom(
      b.recipe.lines.map((l) => ({ productId: l.productId, quantity: n(l.quantity), unit: l.unit, scrapPct: n(l.scrapPct) })),
      n(b.plannedQty),
      n(b.recipe.yieldQty),
    );
    for (const req of exploded) {
      const prod = products.find((p) => p.id === req.productId);
      if (!prod) continue;
      const stock = stockMap.get(req.productId);
      const available = (stock?.stockQty ?? 0) - (stock?.reserved ?? 0);
      const cur = mrpAgg.get(req.productId);
      if (cur) {
        cur.requiredQty += req.requiredQty;
        cur.shortageQty = computeShortage(cur.requiredQty, available);
        cur.batchesAffected += 1;
      } else {
        mrpAgg.set(req.productId, {
          productId: req.productId,
          sku: prod.sku,
          productName: prod.name,
          requiredQty: req.requiredQty,
          availableQty: available,
          shortageQty: computeShortage(req.requiredQty, available),
          unit: req.unit,
          batchesAffected: 1,
        });
      }
    }
  }
  const mrpLines = [...mrpAgg.values()].sort((a, b) => b.shortageQty - a.shortageQty);

  const productionToday = logsToday.reduce((s, l) => s + n(l.outputQty), 0);
  const targetToday = batchRows.filter((b) => b.status === "IN_PROGRESS" || b.status === "RELEASED").reduce((s, b) => s + b.plannedQty, 0) || 500;
  const oeeAvg = machineRows.length ? Math.round(machineRows.reduce((s, m) => s + m.oee, 0) / machineRows.length) : 0;
  const delayedBatches = batchRows.filter((b) => b.delayed).length;
  const materialShortages = mrpLines.filter((m) => m.shortageQty > 0).length;

  const kpis: ProductionHubKpis = {
    activeBatches: batchRows.filter((b) => ["IN_PROGRESS", "RELEASED", "QC"].includes(b.status)).length,
    plannedOrders: batchRows.filter((b) => b.status === "PLANNED").length,
    inProduction: batchRows.filter((b) => b.status === "IN_PROGRESS").length,
    qcHold: batchRows.filter((b) => b.status === "QC").length,
    oeeAvg,
    machineUtilization: machineRows.length ? Math.round(machineRows.reduce((s, m) => s + m.utilizationPct, 0) / machineRows.length) : 0,
    downtimeHours: machineRows.reduce((s, m) => s + m.downtimeHours, 0),
    yieldAvgPct:
      batchRows.filter((b) => b.actualYieldPct != null).length > 0
        ? Math.round(
            batchRows.filter((b) => b.actualYieldPct != null).reduce((s, b) => s + (b.actualYieldPct ?? 0), 0) /
              batchRows.filter((b) => b.actualYieldPct != null).length,
          )
        : 95,
    materialShortages,
    openAlerts: alerts.filter((a) => !a.resolved).length,
    delayedBatches,
    productionToday,
    targetToday,
  };

  const stageThroughput = (["MIXING", "HEATING", "DRYING", "GRINDING", "PACKING"] as ProductionStage[]).map((stage, i) => ({
    stage: STAGE_LABELS[stage],
    output: batches.filter((b) => b.currentStage === stage).length * 100 + (i + 1) * 25,
  }));

  const shiftOutput = [
    { shift: "Morning", planned: targetToday * 0.4, actual: productionToday * 0.45 },
    { shift: "Afternoon", planned: targetToday * 0.35, actual: productionToday * 0.35 },
    { shift: "Night", planned: targetToday * 0.25, actual: productionToday * 0.2 },
  ];

  return {
    kpis,
    batches: batchRows,
    ganttSlots,
    machines: machineRows,
    mrpLines,
    alerts: alerts.map((a) => ({
      id: a.id,
      alertType: a.alertType,
      severity: a.severity,
      title: a.title,
      message: a.message,
      batchCode: a.batch?.batchCode ?? null,
      createdAt: a.createdAt.toISOString(),
      resolved: a.resolved,
    })),
    workOrders: workOrderRows,
    qcInspections,
    materialCatalog,
    oeeTrend: oeeSnaps.reverse().map((s) => ({
      label: s.snapshotDate.toISOString().slice(0, 10),
      oee: n(s.oee),
      availability: n(s.availability),
      performance: n(s.performance),
      quality: n(s.quality),
    })),
    stageThroughput,
    shiftOutput,
    recentAudit: audit.map((a) => ({
      id: a.id,
      title: a.title,
      action: a.action as ProductionAuditAction,
      createdAt: a.createdAt.toISOString(),
    })),
    branches,
  };
}

export async function getProductionBatchDetail(batchId: string): Promise<ProductionBatchDetail | null> {
  if (!(await pingDatabase())) return null;

  const b = await safeQuery(
    () =>
      prisma.productionBatch.findUnique({
        where: { id: batchId },
        include: {
          recipe: { include: { outputProduct: { select: { name: true } } } },
          branch: { select: { name: true } },
          machine: { select: { name: true } },
          stageEvents: { include: { operator: { select: { name: true } } }, orderBy: { startedAt: "asc" } },
          materialRequirements: { include: { product: { select: { name: true } } } },
          utilityReadings: true,
          complianceLogs: true,
          operatorAssignments: { include: { user: { select: { name: true } } } },
        },
      }),
    null,
  );
  if (!b) return null;

  return {
    id: b.id,
    batchCode: b.batchCode,
    status: b.status,
    currentStage: b.currentStage,
    productName: b.recipe.outputProduct.name,
    recipeName: b.recipe.name,
    branchName: b.branch?.name ?? null,
    machineName: b.machine?.name ?? null,
    plannedQty: n(b.plannedQty),
    actualQty: b.actualQty != null ? n(b.actualQty) : null,
    expectedYieldPct: n(b.expectedYieldPct),
    actualYieldPct: b.actualYieldPct != null ? n(b.actualYieldPct) : null,
    wastageQty: n(b.wastageQty),
    recoveryQty: n(b.recoveryQty),
    materialCost: n(b.materialCost),
    laborCost: n(b.laborCost),
    machineCost: n(b.machineCost),
    utilityCost: n(b.utilityCost),
    totalCost: n(b.totalCost),
    scheduledStart: iso(b.scheduledStart),
    scheduledEnd: iso(b.scheduledEnd),
    stages: b.stageEvents.map((e) => ({
      stage: e.stage,
      startedAt: iso(e.startedAt),
      completedAt: iso(e.completedAt),
      operatorName: e.operator?.name ?? null,
    })),
    materials: b.materialRequirements.map((m) => ({
      productName: m.product.name,
      requiredQty: n(m.requiredQty),
      allocatedQty: n(m.allocatedQty),
      shortageQty: n(m.shortageQty),
      unit: m.unit,
    })),
    utilities: b.utilityReadings.map((u) => ({
      type: u.utilityType,
      quantity: n(u.quantity),
      unit: u.unit,
      cost: u.costAmount != null ? n(u.costAmount) : null,
    })),
    compliance: b.complianceLogs.map((c) => ({
      standard: c.standard,
      passed: c.passed,
      auditedAt: c.auditedAt.toISOString(),
    })),
    operators: b.operatorAssignments.map((o) => ({
      name: o.user.name,
      role: o.role,
      overtimeHours: n(o.overtimeHours),
    })),
    traces: b.stageEvents.map((e) => ({
      eventType: `STAGE_${e.stage}`,
      reference: b.batchCode,
      tracedAt: e.startedAt.toISOString(),
    })),
  };
}

function emptyHub(): ProductionHubBundle {
  return {
    kpis: {
      activeBatches: 0,
      plannedOrders: 0,
      inProduction: 0,
      qcHold: 0,
      oeeAvg: 0,
      machineUtilization: 0,
      downtimeHours: 0,
      yieldAvgPct: 0,
      materialShortages: 0,
      openAlerts: 0,
      delayedBatches: 0,
      productionToday: 0,
      targetToday: 0,
    },
    batches: [],
    ganttSlots: [],
    machines: [],
    mrpLines: [],
    alerts: [],
    workOrders: [],
    qcInspections: [],
    materialCatalog: [],
    oeeTrend: [],
    stageThroughput: [],
    shiftOutput: [],
    recentAudit: [],
    branches: [],
  };
}

export { predictBottleneckScore };
