import type { WarehouseAuditAction, WarehouseFacilityKind, WarehouseTransferStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pingDatabase } from "@/lib/db-connection";
import {
  bucketStockAge,
  computeDispatchEfficiency,
  computeTurnoverDays,
  computeUtilizationPct,
  isOverflow,
  isQuarantineStatus,
} from "@/lib/warehouse-engine";
import type {
  BranchDetail,
  BranchRow,
  DispatchRow,
  DistributionCenterRow,
  TransferRow,
  WarehouseDetail,
  WarehouseGovernanceRow,
  WarehouseHubBundle,
  WarehouseHubKpis,
  WarehouseMapPoint,
  WarehouseTaskRow,
} from "@/lib/warehouse-types";
import { safeQuery } from "@/lib/prisma-safe";

function toNum(v: unknown): number {
  if (v == null) return 0;
  return Number(v);
}

function iso(d: Date | null | undefined): string | null {
  return d ? d.toISOString() : null;
}

async function loadWarehouseInventoryStats() {
  const products = await safeQuery(
    () =>
      prisma.product.findMany({
        where: { active: true },
        select: {
          id: true,
          warehouseId: true,
          stockQty: true,
          costPrice: true,
          inventoryClass: true,
        },
      }),
    [],
  );

  const batches = await safeQuery(
    () =>
      prisma.batch.findMany({
        select: {
          id: true,
          warehouseId: true,
          quantity: true,
          inventoryStatus: true,
          expiryDate: true,
          createdAt: true,
          product: { select: { costPrice: true, name: true } },
        },
      }),
    [],
  );

  const byWarehouse = new Map<
    string,
    { value: number; skus: Set<string>; quarantineQty: number; batchCount: number }
  >();

  for (const p of products) {
    if (!p.warehouseId) continue;
    const cur = byWarehouse.get(p.warehouseId) ?? { value: 0, skus: new Set(), quarantineQty: 0, batchCount: 0 };
    cur.value += toNum(p.stockQty) * toNum(p.costPrice);
    cur.skus.add(p.id);
    byWarehouse.set(p.warehouseId, cur);
  }

  for (const b of batches) {
    if (!b.warehouseId) continue;
    const cur = byWarehouse.get(b.warehouseId) ?? { value: 0, skus: new Set(), quarantineQty: 0, batchCount: 0 };
    cur.batchCount += 1;
    if (isQuarantineStatus(b.inventoryStatus)) cur.quarantineQty += toNum(b.quantity);
    byWarehouse.set(b.warehouseId, cur);
  }

  return byWarehouse;
}

function mapTransfer(t: {
  id: string;
  transferNumber: string;
  status: WarehouseTransferStatus;
  transporterName: string | null;
  lrNumber: string | null;
  vehicleNumber: string | null;
  requestedAt: Date;
  shippedAt: Date | null;
  receivedAt: Date | null;
  fromWarehouse: { name: string };
  toWarehouse: { name: string };
  items: { quantity: unknown }[];
}): TransferRow {
  return {
    id: t.id,
    transferNumber: t.transferNumber,
    fromWarehouse: t.fromWarehouse.name,
    toWarehouse: t.toWarehouse.name,
    status: t.status,
    itemCount: t.items.length,
    totalQty: t.items.reduce((s, i) => s + toNum(i.quantity), 0),
    transporterName: t.transporterName,
    lrNumber: t.lrNumber,
    vehicleNumber: t.vehicleNumber,
    requestedAt: t.requestedAt.toISOString(),
    shippedAt: iso(t.shippedAt),
    receivedAt: iso(t.receivedAt),
  };
}

function mapDispatch(d: {
  id: string;
  dispatchNumber: string;
  status: import("@prisma/client").PickPackStatus;
  transporterName: string | null;
  lrNumber: string | null;
  dockBay: string | null;
  createdAt: Date;
  dispatchedAt: Date | null;
  warehouse: { name: string } | null;
  lines: { quantity: unknown; pickedQty: unknown }[];
}): DispatchRow {
  const totalQty = d.lines.reduce((s, l) => s + toNum(l.quantity), 0);
  const pickedQty = d.lines.reduce((s, l) => s + toNum(l.pickedQty), 0);
  return {
    id: d.id,
    dispatchNumber: d.dispatchNumber,
    warehouseName: d.warehouse?.name ?? null,
    status: d.status,
    lineCount: d.lines.length,
    totalQty,
    pickedPct: totalQty > 0 ? Math.round((pickedQty / totalQty) * 1000) / 10 : 0,
    transporterName: d.transporterName,
    lrNumber: d.lrNumber,
    dockBay: d.dockBay,
    createdAt: d.createdAt.toISOString(),
    dispatchedAt: iso(d.dispatchedAt),
  };
}

export async function getWarehouseHubBundle(): Promise<WarehouseHubBundle> {
  if (!(await pingDatabase())) {
    return emptyHub();
  }

  const invStats = await loadWarehouseInventoryStats();

  const [branches, warehouses, dcs, transfers, dispatches, tasks, audit, batches, dockToday] = await Promise.all([
    safeQuery(
      () =>
        prisma.branch.findMany({
          include: { _count: { select: { warehouses: true, distributionCenters: true } } },
          orderBy: { name: "asc" },
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.warehouse.findMany({
          include: {
            branch: { select: { name: true } },
            distributionCenter: { select: { name: true } },
            _count: { select: { bins: true, transfersFrom: true, pickPackTasks: true } },
          },
          orderBy: { name: "asc" },
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.distributionCenter.findMany({
          include: {
            branch: { select: { name: true } },
            _count: { select: { warehouses: true } },
          },
          orderBy: { name: "asc" },
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.warehouseTransfer.findMany({
          include: {
            fromWarehouse: { select: { name: true } },
            toWarehouse: { select: { name: true } },
            items: { select: { quantity: true } },
          },
          orderBy: { requestedAt: "desc" },
          take: 20,
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.pickPackDispatch.findMany({
          include: {
            warehouse: { select: { name: true } },
            lines: { select: { quantity: true, pickedQty: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.warehouseTask.findMany({
          where: { status: { in: ["OPEN", "ASSIGNED", "IN_PROGRESS"] } },
          include: {
            warehouse: { select: { name: true } },
            bin: { select: { code: true } },
            assignedTo: { select: { name: true } },
          },
          orderBy: [{ priority: "asc" }, { dueAt: "asc" }],
          take: 15,
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.warehouseAuditLog.findMany({
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.batch.findMany({
          select: { quantity: true, createdAt: true, product: { select: { costPrice: true } } },
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.dockAppointment.count({
          where: {
            scheduledAt: {
              gte: new Date(new Date().setHours(0, 0, 0, 0)),
              lt: new Date(new Date().setHours(23, 59, 59, 999)),
            },
          },
        }),
      0,
    ),
  ]);

  const branchRows: BranchRow[] = branches.map((b) => {
    const whIds = warehouses.filter((w) => w.branchId === b.id).map((w) => w.id);
    let inventoryValue = 0;
    let activeSkus = 0;
    for (const id of whIds) {
      const s = invStats.get(id);
      if (s) {
        inventoryValue += s.value;
        activeSkus += s.skus.size;
      }
    }
    return {
      id: b.id,
      code: b.code,
      name: b.name,
      region: b.region,
      city: b.city,
      state: b.state,
      warehouseCount: b._count.warehouses,
      dcCount: b._count.distributionCenters,
      inventoryValue,
      activeSkus,
      latitude: b.latitude != null ? toNum(b.latitude) : null,
      longitude: b.longitude != null ? toNum(b.longitude) : null,
      isActive: b.isActive,
    };
  });

  const warehouseRows: WarehouseGovernanceRow[] = warehouses.map((w) => {
    const stats = invStats.get(w.id);
    const usedKg = toNum(w.storageUsedKg);
    const capKg = toNum(w.storageCapacityKg);
    const utilizationPct = computeUtilizationPct(usedKg, capKg || usedKg || 1);
    const palletUtilizationPct = computeUtilizationPct(usedKg, toNum(w.palletCapacity) * 1000 || 1);
    const openTransfers = transfers.filter(
      (t) =>
        (t.fromWarehouseId === w.id || t.toWarehouseId === w.id) &&
        !["RECEIVED", "CANCELLED"].includes(t.status),
    ).length;
    const pendingDispatch = dispatches.filter(
      (d) => d.warehouseId === w.id && !["DISPATCHED", "DELIVERED"].includes(d.status),
    ).length;

    return {
      id: w.id,
      code: w.code ?? w.id.slice(0, 8),
      name: w.name,
      facilityKind: w.facilityKind as WarehouseFacilityKind,
      branchName: w.branch?.name ?? null,
      dcName: w.distributionCenter?.name ?? null,
      city: w.city,
      inventoryValue: stats?.value ?? 0,
      activeSkus: stats?.skus.size ?? 0,
      batchCount: stats?.batchCount ?? 0,
      binCount: w._count.bins,
      utilizationPct,
      palletUtilizationPct,
      quarantineQty: stats?.quarantineQty ?? 0,
      openTransfers,
      pendingDispatch,
      isColdStorage: w.isColdStorage,
      overflow: isOverflow(utilizationPct),
      latitude: w.latitude != null ? toNum(w.latitude) : null,
      longitude: w.longitude != null ? toNum(w.longitude) : null,
      active: w.active,
    };
  });

  const dcRows: DistributionCenterRow[] = dcs.map((dc) => ({
    id: dc.id,
    code: dc.code,
    name: dc.name,
    region: dc.region,
    branchName: dc.branch?.name ?? null,
    warehouseCount: dc._count.warehouses,
    palletCapacity: dc.palletCapacity,
    utilizationPct: computeUtilizationPct(
      warehouses.filter((w) => w.distributionCenterId === dc.id).reduce((s, w) => s + toNum(w.storageUsedKg), 0),
      toNum(dc.storageCapacityKg) || dc.palletCapacity * 1000,
    ),
    latitude: dc.latitude != null ? toNum(dc.latitude) : null,
    longitude: dc.longitude != null ? toNum(dc.longitude) : null,
    active: dc.active,
  }));

  const agingBuckets = { "0-30": { qty: 0, value: 0 }, "31-60": { qty: 0, value: 0 }, "61-90": { qty: 0, value: 0 }, "90+": { qty: 0, value: 0 } };
  for (const b of batches) {
    const days = Math.floor((Date.now() - b.createdAt.getTime()) / (1000 * 60 * 60 * 24));
    const bucket = bucketStockAge(days);
    const key = bucket === "0-30" ? "0-30" : bucket === "31-60" ? "31-60" : bucket === "61-90" ? "61-90" : "90+";
    agingBuckets[key].qty += toNum(b.quantity);
    agingBuckets[key].value += toNum(b.quantity) * toNum(b.product.costPrice);
  }

  const totalValue = warehouseRows.reduce((s, w) => s + w.inventoryValue, 0);
  const openTransferCount = transfers.filter((t) => !["RECEIVED", "CANCELLED"].includes(t.status)).length;
  const pendingDispatchCount = dispatches.filter((d) => !["DISPATCHED", "DELIVERED"].includes(d.status)).length;
  const dispatchedCount = dispatches.filter((d) => ["DISPATCHED", "DELIVERED"].includes(d.status)).length;
  const overflowAlerts = warehouseRows.filter((w) => w.overflow).length;

  const kpis: WarehouseHubKpis = {
    branchCount: branches.filter((b) => b.isActive).length,
    warehouseCount: warehouses.filter((w) => w.active).length,
    distributionCenterCount: dcs.filter((d) => d.active).length,
    totalInventoryValue: totalValue,
    activeSkus: warehouseRows.reduce((s, w) => s + w.activeSkus, 0),
    openTransfers: openTransferCount,
    pendingDispatch: pendingDispatchCount,
    avgUtilizationPct:
      warehouseRows.length > 0
        ? Math.round(warehouseRows.reduce((s, w) => s + w.utilizationPct, 0) / warehouseRows.length)
        : 0,
    overflowAlerts,
    quarantineQty: warehouseRows.reduce((s, w) => s + w.quarantineQty, 0),
    openTasks: tasks.length,
    dockToday,
    dispatchEfficiencyPct: computeDispatchEfficiency(dispatchedCount, dispatches.length || 1),
    turnoverDays: computeTurnoverDays(totalValue, totalValue * 0.35),
  };

  const mapPoints: WarehouseMapPoint[] = [
    ...branchRows
      .filter((b) => b.latitude != null && b.longitude != null)
      .map((b) => ({
        id: b.id,
        name: b.name,
        kind: "branch" as const,
        latitude: b.latitude!,
        longitude: b.longitude!,
        inventoryValue: b.inventoryValue,
        utilizationPct: 0,
      })),
    ...warehouseRows
      .filter((w) => w.latitude != null && w.longitude != null)
      .map((w) => ({
        id: w.id,
        name: w.name,
        kind: "warehouse" as const,
        latitude: w.latitude!,
        longitude: w.longitude!,
        inventoryValue: w.inventoryValue,
        utilizationPct: w.utilizationPct,
      })),
    ...dcRows
      .filter((d) => d.latitude != null && d.longitude != null)
      .map((d) => ({
        id: d.id,
        name: d.name,
        kind: "dc" as const,
        latitude: d.latitude!,
        longitude: d.longitude!,
        inventoryValue: 0,
        utilizationPct: d.utilizationPct,
      })),
  ];

  return {
    kpis,
    branches: branchRows,
    warehouses: warehouseRows,
    distributionCenters: dcRows,
    transfers: transfers.map(mapTransfer),
    dispatches: dispatches.map(mapDispatch),
    tasks: tasks.map((t) => ({
      id: t.id,
      warehouseName: t.warehouse.name,
      taskType: t.taskType,
      status: t.status,
      title: t.title,
      binCode: t.bin?.code ?? null,
      assigneeName: t.assignedTo?.name ?? null,
      priority: t.priority,
      dueAt: iso(t.dueAt),
    })),
    mapPoints,
    utilizationTrend: warehouseRows.slice(0, 6).map((w) => ({
      label: w.code.slice(0, 8),
      utilization: w.utilizationPct,
      value: w.inventoryValue,
    })),
    agingBuckets: [
      { label: "0–30 days", qty: agingBuckets["0-30"].qty, value: agingBuckets["0-30"].value },
      { label: "31–60 days", qty: agingBuckets["31-60"].qty, value: agingBuckets["31-60"].value },
      { label: "61–90 days", qty: agingBuckets["61-90"].qty, value: agingBuckets["61-90"].value },
      { label: "90+ days", qty: agingBuckets["90+"].qty, value: agingBuckets["90+"].value },
    ],
    recentAudit: audit.map((a) => ({
      id: a.id,
      title: a.title,
      action: a.action as WarehouseAuditAction,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function getWarehouseDetail(warehouseId: string): Promise<WarehouseDetail | null> {
  if (!(await pingDatabase())) return null;

  const w = await safeQuery(
    () =>
      prisma.warehouse.findUnique({
        where: { id: warehouseId },
        include: {
          branch: { select: { name: true } },
          distributionCenter: { select: { name: true } },
          zones: { include: { _count: { select: { bins: true, racks: true } } } },
          bins: { take: 50, orderBy: { code: "asc" } },
          staffAssignments: {
            where: { active: true },
            include: { user: { select: { id: true, name: true, email: true } } },
          },
          environmentalReadings: { orderBy: { recordedAt: "desc" }, take: 10 },
          forecastPoints: { orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }], take: 12 },
          batchTraces: {
            orderBy: { tracedAt: "desc" },
            take: 15,
            include: { actor: { select: { name: true } } },
          },
        },
      }),
    null,
  );
  if (!w) return null;

  const [batches, transfers, dispatches, tasks, products] = await Promise.all([
    safeQuery(
      () =>
        prisma.batch.findMany({
          where: { warehouseId },
          include: { product: { select: { name: true } }, bin: { select: { code: true } } },
          orderBy: { expiryDate: "asc" },
          take: 30,
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.warehouseTransfer.findMany({
          where: { OR: [{ fromWarehouseId: warehouseId }, { toWarehouseId: warehouseId }] },
          include: {
            fromWarehouse: { select: { name: true } },
            toWarehouse: { select: { name: true } },
            items: { select: { quantity: true } },
          },
          orderBy: { requestedAt: "desc" },
          take: 10,
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.pickPackDispatch.findMany({
          where: { warehouseId },
          include: {
            warehouse: { select: { name: true } },
            lines: { select: { quantity: true, pickedQty: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.warehouseTask.findMany({
          where: { warehouseId, status: { not: "COMPLETED" } },
          include: {
            warehouse: { select: { name: true } },
            bin: { select: { code: true } },
            assignedTo: { select: { name: true } },
          },
          take: 15,
        }),
      [],
    ),
    safeQuery(
      () =>
        prisma.product.findMany({
          where: { warehouseId, active: true },
          select: { stockQty: true, costPrice: true },
        }),
      [],
    ),
  ]);

  const inventoryValue = products.reduce((s, p) => s + toNum(p.stockQty) * toNum(p.costPrice), 0);
  const usedKg = toNum(w.storageUsedKg);
  const capKg = toNum(w.storageCapacityKg) || usedKg || 1;
  const utilizationPct = computeUtilizationPct(usedKg, capKg);
  const quarantineQty = batches
    .filter((b) => isQuarantineStatus(b.inventoryStatus))
    .reduce((s, b) => s + toNum(b.quantity), 0);
  const now = Date.now();
  const fefoAlerts = batches.filter(
    (b) => b.expiryDate && b.expiryDate.getTime() - now < 30 * 24 * 60 * 60 * 1000,
  ).length;

  return {
    id: w.id,
    code: w.code ?? w.id.slice(0, 8),
    name: w.name,
    facilityKind: w.facilityKind,
    branchName: w.branch?.name ?? null,
    dcName: w.distributionCenter?.name ?? null,
    address: w.address ?? w.location,
    city: w.city,
    inventoryValue,
    activeSkus: products.length,
    utilizationPct,
    palletUtilizationPct: computeUtilizationPct(usedKg, toNum(w.palletCapacity) * 1000 || 1),
    quarantineQty,
    fefoAlerts,
    isColdStorage: w.isColdStorage,
    tempRange:
      w.tempMinC != null && w.tempMaxC != null ? `${toNum(w.tempMinC)}°C – ${toNum(w.tempMaxC)}°C` : null,
    humidityRange:
      w.humidityMinPct != null && w.humidityMaxPct != null
        ? `${toNum(w.humidityMinPct)}% – ${toNum(w.humidityMaxPct)}%`
        : null,
    latitude: w.latitude != null ? toNum(w.latitude) : null,
    longitude: w.longitude != null ? toNum(w.longitude) : null,
    zones: w.zones.map((z) => ({
      id: z.id,
      code: z.code,
      name: z.name,
      zoneType: z.zoneType,
      utilizationPct: computeUtilizationPct(toNum(z.usedKg), toNum(z.capacityKg) || toNum(z.usedKg) || 1),
      binCount: z._count.bins,
    })),
    hierarchy: w.bins.map((b) => ({
      zone: b.zone ?? "—",
      rack: b.rack ?? "—",
      shelf: b.shelf ?? "—",
      bin: b.code,
      usedKg: toNum(b.usedKg),
      capacityKg: toNum(b.capacityKg),
    })),
    batches: batches.map((b) => ({
      id: b.id,
      batchNumber: b.batchNumber,
      productName: b.product.name,
      qty: toNum(b.quantity),
      status: b.inventoryStatus,
      expiryDate: iso(b.expiryDate),
      binCode: b.bin?.code ?? null,
    })),
    staff: w.staffAssignments.map((s) => ({
      id: s.user.id,
      name: s.user.name,
      role: s.staffRole,
      email: s.user.email,
    })),
    tasks: tasks.map((t) => ({
      id: t.id,
      warehouseName: t.warehouse.name,
      taskType: t.taskType,
      status: t.status,
      title: t.title,
      binCode: t.bin?.code ?? null,
      assigneeName: t.assignedTo?.name ?? null,
      priority: t.priority,
      dueAt: iso(t.dueAt),
    })),
    transfers: transfers.map(mapTransfer),
    dispatches: dispatches.map(mapDispatch),
    environmental: w.environmentalReadings.map((r) => ({
      recordedAt: r.recordedAt.toISOString(),
      temperatureC: r.temperatureC != null ? toNum(r.temperatureC) : null,
      humidityPct: r.humidityPct != null ? toNum(r.humidityPct) : null,
      inRange: r.inRange,
    })),
    forecast: w.forecastPoints.map((f) => ({
      label: `${f.periodYear}-${String(f.periodMonth).padStart(2, "0")}`,
      demand: toNum(f.demandForecast),
      replenishment: toNum(f.replenishmentQty),
      aiOptimized: toNum(f.aiOptimizedQty),
    })),
    traces: batches.slice(0, 5).map((b, i) => ({
      id: `trace-${b.id}-${i}`,
      eventType: "BATCH_ON_HAND",
      productName: b.product.name,
      quantity: toNum(b.quantity),
      reference: b.batchNumber,
      tracedAt: b.createdAt.toISOString(),
    })),
  };
}

export async function getBranchDetail(branchId: string): Promise<BranchDetail | null> {
  if (!(await pingDatabase())) return null;

  const branch = await safeQuery(
    () =>
      prisma.branch.findUnique({
        where: { id: branchId },
        include: {
          warehouses: {
            include: {
              branch: { select: { name: true } },
              distributionCenter: { select: { name: true } },
              _count: { select: { bins: true } },
            },
          },
          distributionCenters: {
            include: { branch: { select: { name: true } }, _count: { select: { warehouses: true } } },
          },
          regionalPlans: { orderBy: { planYear: "desc" }, take: 6 },
        },
      }),
    null,
  );
  if (!branch) return null;

  const invStats = await loadWarehouseInventoryStats();
  let inventoryValue = 0;
  let activeSkus = 0;
  for (const w of branch.warehouses) {
    const s = invStats.get(w.id);
    if (s) {
      inventoryValue += s.value;
      activeSkus += s.skus.size;
    }
  }

  const warehouseRows: WarehouseGovernanceRow[] = branch.warehouses.map((w) => {
    const stats = invStats.get(w.id);
    const usedKg = toNum(w.storageUsedKg);
    const utilizationPct = computeUtilizationPct(usedKg, toNum(w.storageCapacityKg) || usedKg || 1);
    return {
      id: w.id,
      code: w.code ?? w.id.slice(0, 8),
      name: w.name,
      facilityKind: w.facilityKind,
      branchName: branch.name,
      dcName: w.distributionCenter?.name ?? null,
      city: w.city,
      inventoryValue: stats?.value ?? 0,
      activeSkus: stats?.skus.size ?? 0,
      batchCount: stats?.batchCount ?? 0,
      binCount: w._count.bins,
      utilizationPct,
      palletUtilizationPct: computeUtilizationPct(usedKg, toNum(w.palletCapacity) * 1000 || 1),
      quarantineQty: stats?.quarantineQty ?? 0,
      openTransfers: 0,
      pendingDispatch: 0,
      isColdStorage: w.isColdStorage,
      overflow: isOverflow(utilizationPct),
      latitude: w.latitude != null ? toNum(w.latitude) : null,
      longitude: w.longitude != null ? toNum(w.longitude) : null,
      active: w.active,
    };
  });

  return {
    id: branch.id,
    code: branch.code,
    name: branch.name,
    region: branch.region,
    address: branch.address,
    city: branch.city,
    state: branch.state,
    phone: branch.phone,
    email: branch.email,
    latitude: branch.latitude != null ? toNum(branch.latitude) : null,
    longitude: branch.longitude != null ? toNum(branch.longitude) : null,
    warehouseCount: branch.warehouses.length,
    dcCount: branch.distributionCenters.length,
    inventoryValue,
    activeSkus,
    warehouses: warehouseRows,
    distributionCenters: branch.distributionCenters.map((dc) => ({
      id: dc.id,
      code: dc.code,
      name: dc.name,
      region: dc.region,
      branchName: branch.name,
      warehouseCount: dc._count.warehouses,
      palletCapacity: dc.palletCapacity,
      utilizationPct: 0,
      latitude: dc.latitude != null ? toNum(dc.latitude) : null,
      longitude: dc.longitude != null ? toNum(dc.longitude) : null,
      active: dc.active,
    })),
    regionalPlans: branch.regionalPlans.map((p) => ({
      id: p.id,
      region: p.region,
      planYear: p.planYear,
      targetVolume: toNum(p.targetVolume),
      actualVolume: toNum(p.actualVolume),
      attainmentPct:
        toNum(p.targetVolume) > 0
          ? Math.round((toNum(p.actualVolume) / toNum(p.targetVolume)) * 1000) / 10
          : 0,
    })),
  };
}

function emptyHub(): WarehouseHubBundle {
  return {
    kpis: {
      branchCount: 0,
      warehouseCount: 0,
      distributionCenterCount: 0,
      totalInventoryValue: 0,
      activeSkus: 0,
      openTransfers: 0,
      pendingDispatch: 0,
      avgUtilizationPct: 0,
      overflowAlerts: 0,
      quarantineQty: 0,
      openTasks: 0,
      dockToday: 0,
      dispatchEfficiencyPct: 0,
      turnoverDays: 0,
    },
    branches: [],
    warehouses: [],
    distributionCenters: [],
    transfers: [],
    dispatches: [],
    tasks: [],
    mapPoints: [],
    utilizationTrend: [],
    agingBuckets: [],
    recentAudit: [],
  };
}
