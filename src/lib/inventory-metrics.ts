import type { InventoryItemClass } from "@prisma/client";
import { prisma } from "@/lib/db";
import { pingDatabase } from "@/lib/db-connection";
import {
  buildInventoryBarcode,
  computeAvailableQty,
  daysToExpiry,
  isDeadStock,
  isLowStock,
  isNearExpiry,
  valueInventory,
} from "@/lib/inventory-engine";
import type {
  BatchRow,
  InventoryDetail,
  InventoryHubBundle,
  InventoryHubKpis,
  InventoryRow,
  MovementRow,
  ReservationRow,
} from "@/lib/inventory-types";
import { INVENTORY_CLASS_LABELS } from "@/lib/inventory-types";
import { barcodeSvg, codesToDataUri } from "@/lib/grn-codes";
import { safeQuery } from "@/lib/prisma-safe";

function toNumber(v: unknown): number {
  if (v == null) return 0;
  return Number(v);
}

type RawProduct = Awaited<ReturnType<typeof loadProducts>>[number];

async function loadProducts() {
  return safeQuery(
    () =>
      prisma.product.findMany({
        include: {
          category: { select: { name: true } },
          warehouse: { select: { name: true } },
          batches: {
            include: { bin: { select: { code: true, zone: true } } },
            orderBy: { expiryDate: "asc" },
          },
          reservations: { where: { releasedAt: null } },
          movements: { orderBy: { createdAt: "desc" }, take: 1 },
        },
        orderBy: { name: "asc" },
        take: 80,
      }),
    [],
  );
}

function mapProductRow(p: RawProduct): InventoryRow {
  const stockQty = toNumber(p.stockQty);
  const reservedQty = p.reservations.reduce((s, r) => s + toNumber(r.quantity), 0);
  const availableQty = computeAvailableQty(stockQty, reservedQty);
  const minStock = toNumber(p.minStockQty);
  const safetyStock = toNumber(p.safetyStockQty ?? p.minStockQty);
  const reorderPoint = toNumber(p.reorderPoint ?? p.minStockQty);
  const costPrice = toNumber(p.costPrice);
  const batches = p.batches.map((b) => ({
    id: b.id,
    quantity: toNumber(b.quantity),
    reservedQty: toNumber(b.reservedQty ?? 0),
    expiryDate: b.expiryDate,
    mfgDate: b.mfgDate,
    landedCost: b.landedCost != null ? toNumber(b.landedCost) : null,
    createdAt: b.createdAt,
  }));
  const stockValue = valueInventory(stockQty, costPrice, batches, p.valuationMethod ?? "FIFO");
  const lastMove = p.movements[0]?.createdAt ?? null;
  const nearExpiryBatches = p.batches.filter((b) => isNearExpiry(b.expiryDate)).length;

  return {
    id: p.id,
    sku: p.sku,
    name: p.name,
    inventoryClass: p.inventoryClass ?? "RAW_MATERIAL",
    categoryName: p.category?.name ?? null,
    warehouseName: p.warehouse?.name ?? null,
    unit: p.unit,
    stockQty,
    reservedQty,
    availableQty,
    minStockQty: minStock,
    safetyStockQty: safetyStock,
    reorderPoint,
    costPrice,
    stockValue,
    valuationMethod: p.valuationMethod ?? "FIFO",
    rotationPolicy: p.rotationPolicy ?? "FEFO",
    batchCount: p.batches.length,
    nearExpiryBatches,
    reorderAlert: availableQty <= reorderPoint,
    lowStock: isLowStock(availableQty, minStock, reorderPoint),
    deadStock: isDeadStock(lastMove) && stockQty > 0,
    barcode: p.barcode,
  };
}

function mapBatchRow(b: RawProduct["batches"][number]): BatchRow {
  const dte = daysToExpiry(b.expiryDate);
  const trace = buildInventoryBarcode(b.productId.slice(-6), b.batchNumber);
  return {
    id: b.id,
    batchNumber: b.batchNumber,
    quantity: toNumber(b.quantity),
    reservedQty: toNumber(b.reservedQty ?? 0),
    supplierBatch: b.supplierBatch,
    productionBatch: b.productionBatch ?? null,
    dispatchBatchRef: b.dispatchBatchRef ?? null,
    mfgDate: b.mfgDate?.toISOString() ?? null,
    expiryDate: b.expiryDate?.toISOString() ?? null,
    inventoryStatus: b.inventoryStatus ?? "AVAILABLE",
    qcStatus: b.qcStatus ?? "PENDING",
    binCode: b.bin?.code ?? null,
    zone: b.bin?.zone ?? null,
    landedCost: b.landedCost != null ? toNumber(b.landedCost) : null,
    yieldPct: b.yieldPct != null ? toNumber(b.yieldPct) : null,
    daysToExpiry: dte,
    barcodeData: b.barcodeData ?? codesToDataUri(barcodeSvg(trace)),
  };
}

function computeKpis(rows: InventoryRow[], nearExpiry: BatchRow[]): InventoryHubKpis {
  return {
    totalValue: rows.reduce((s, r) => s + r.stockValue, 0),
    skuCount: rows.length,
    lowStock: rows.filter((r) => r.lowStock).length,
    deadStock: rows.filter((r) => r.deadStock).length,
    nearExpiry: nearExpiry.length,
    quarantineQty: rows.filter((r) => r.inventoryClass === "QUARANTINE").reduce((s, r) => s + r.stockQty, 0),
    rejectedQty: rows.filter((r) => r.inventoryClass === "REJECTED").reduce((s, r) => s + r.stockQty, 0),
    openTransfers: 0,
    pendingPickPack: 0,
    reservedQty: rows.reduce((s, r) => s + r.reservedQty, 0),
    avgYieldPct: 91,
    reorderAlerts: rows.filter((r) => r.reorderAlert).length,
  };
}

const emptyBundle = (): InventoryHubBundle => ({
  rows: [],
  kpis: {
    totalValue: 0,
    skuCount: 0,
    lowStock: 0,
    deadStock: 0,
    nearExpiry: 0,
    quarantineQty: 0,
    rejectedQty: 0,
    openTransfers: 0,
    pendingPickPack: 0,
    reservedQty: 0,
    avgYieldPct: 0,
    reorderAlerts: 0,
  },
  transfers: [],
  pickPack: [],
  recentMovements: [],
  classBreakdown: [],
  nearExpiry: [],
  recentAudit: [],
});

export async function getInventoryHubBundle(): Promise<InventoryHubBundle> {
  if (!(await pingDatabase())) return emptyBundle();

  const products = await loadProducts();
  const rows = products.map(mapProductRow);

  const nearExpiry: BatchRow[] = [];
  for (const p of products) {
    for (const b of p.batches) {
      if (isNearExpiry(b.expiryDate)) nearExpiry.push(mapBatchRow(b));
    }
  }

  const classMap = new Map<InventoryItemClass, { qty: number; value: number }>();
  for (const r of rows) {
    const e = classMap.get(r.inventoryClass) ?? { qty: 0, value: 0 };
    e.qty += r.stockQty;
    e.value += r.stockValue;
    classMap.set(r.inventoryClass, e);
  }

  const kpis = computeKpis(rows, nearExpiry);

  const transfers = await safeQuery(
    () =>
      prisma.warehouseTransfer.findMany({
        include: {
          fromWarehouse: { select: { name: true } },
          toWarehouse: { select: { name: true } },
          items: true,
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    [],
  );

  const pickPack = await safeQuery(
    () =>
      prisma.pickPackDispatch.findMany({
        include: { warehouse: { select: { name: true } }, lines: true },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    [],
  );

  const recentMovements = await safeQuery(
    () =>
      prisma.stockMovement.findMany({
        include: { warehouse: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 25,
      }),
    [],
  );

  const recentAudit = await safeQuery(
    () =>
      prisma.inventoryAuditLog.findMany({
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
    [],
  );

  kpis.openTransfers = transfers.filter((t) => t.status === "IN_TRANSIT" || t.status === "DRAFT").length;
  kpis.pendingPickPack = pickPack.filter((p) => p.status === "PENDING" || p.status === "PICKING").length;

  return {
    rows,
    kpis,
    transfers: transfers.map((t) => ({
      id: t.id,
      transferNumber: t.transferNumber,
      fromWarehouse: t.fromWarehouse.name,
      toWarehouse: t.toWarehouse.name,
      status: t.status,
      itemCount: t.items.length,
      createdAt: t.createdAt.toISOString(),
    })),
    pickPack: pickPack.map((p) => ({
      id: p.id,
      dispatchNumber: p.dispatchNumber,
      status: p.status,
      warehouseName: p.warehouse?.name ?? null,
      lineCount: p.lines.length,
      createdAt: p.createdAt.toISOString(),
    })),
    recentMovements: recentMovements.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: toNumber(m.quantity),
      unit: m.unit ?? "kg",
      reference: m.reference,
      referenceType: m.referenceType,
      reasonCode: m.reasonCode,
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
      warehouseName: m.warehouse?.name ?? null,
    })),
    classBreakdown: [...classMap.entries()].map(([cls, v]) => ({
      class: cls,
      label: INVENTORY_CLASS_LABELS[cls],
      qty: v.qty,
      value: v.value,
    })),
    nearExpiry,
    recentAudit: recentAudit.map((a) => ({
      id: a.id,
      action: a.action,
      title: a.title,
      detail: a.detail,
      actorName: a.actor?.name ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

export async function getInventoryDetail(productId: string): Promise<InventoryDetail | null> {
  const p = await safeQuery(
    () =>
      prisma.product.findUnique({
        where: { id: productId },
        include: {
          category: { select: { name: true } },
          warehouse: { select: { name: true } },
          batches: { include: { bin: { select: { code: true, zone: true } } }, orderBy: { expiryDate: "asc" } },
          reservations: { where: { releasedAt: null } },
          forecastPoints: { orderBy: [{ periodYear: "asc" }, { periodMonth: "asc" }] },
          movements: { orderBy: { createdAt: "desc" }, take: 1 },
        },
      }),
    null,
  );

  if (!p) return null;

  const product = mapProductRow(p as RawProduct);

  const movements = await safeQuery(
    () =>
      prisma.stockMovement.findMany({
        where: { productId },
        include: { warehouse: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 40,
      }),
    [],
  );

  const auditLog = await safeQuery(
    () =>
      prisma.inventoryAuditLog.findMany({
        where: { productId },
        include: { actor: { select: { name: true } } },
        orderBy: { createdAt: "desc" },
        take: 20,
      }),
    [],
  );

  const raw = p as RawProduct & {
    forecastPoints?: { periodYear: number; periodMonth: number; demandForecast: unknown; actualDemand: unknown; aiForecast: unknown }[];
  };

  return {
    product,
    batches: raw.batches.map(mapBatchRow),
    movements: movements.map((m) => ({
      id: m.id,
      type: m.type,
      quantity: toNumber(m.quantity),
      unit: m.unit ?? "kg",
      reference: m.reference,
      referenceType: m.referenceType,
      reasonCode: m.reasonCode,
      notes: m.notes,
      createdAt: m.createdAt.toISOString(),
      warehouseName: m.warehouse?.name ?? null,
    })),
    reservations: raw.reservations.map((r) => ({
      id: r.id,
      purpose: r.purpose,
      quantity: toNumber(r.quantity),
      unit: r.unit,
      referenceId: r.referenceId,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      createdAt: r.createdAt.toISOString(),
    })),
    auditLog: auditLog.map((a) => ({
      id: a.id,
      action: a.action,
      title: a.title,
      detail: a.detail,
      actorName: a.actor?.name ?? null,
      createdAt: a.createdAt.toISOString(),
    })),
    demandForecast:
      raw.forecastPoints?.map((f) => ({
        month: `${f.periodYear}-${String(f.periodMonth).padStart(2, "0")}`,
        demand: toNumber(f.demandForecast),
        actual: f.actualDemand != null ? toNumber(f.actualDemand) : null,
        aiForecast: f.aiForecast != null ? toNumber(f.aiForecast) : null,
      })) ?? [],
  };
}
