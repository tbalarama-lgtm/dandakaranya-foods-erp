import type { InventoryValuationMethod, StockRotationPolicy } from "@prisma/client";
import { UNIT_CONVERSIONS } from "@/lib/inventory-types";

export type BatchForFefo = {
  id: string;
  quantity: number;
  reservedQty: number;
  expiryDate: Date | null;
  mfgDate: Date | null;
  landedCost: number | null;
  createdAt: Date;
};

export function convertUnit(qty: number, fromUnit: string, toUnit: string): number {
  const from = fromUnit.toLowerCase();
  const to = toUnit.toLowerCase();
  if (from === to) return qty;
  const table = UNIT_CONVERSIONS[from];
  if (!table?.[to]) return qty;
  return Math.round(qty * table[to] * 1000) / 1000;
}

export function computeAvailableQty(stockQty: number, reservedQty: number): number {
  return Math.max(0, stockQty - reservedQty);
}

export function isLowStock(stockQty: number, minStock: number, reorderPoint: number): boolean {
  return stockQty <= minStock || stockQty <= reorderPoint;
}

export function isDeadStock(lastMovementAt: Date | null, days = 90): boolean {
  if (!lastMovementAt) return true;
  return Date.now() - lastMovementAt.getTime() > days * 24 * 60 * 60 * 1000;
}

export function daysToExpiry(expiryDate: Date | null): number | null {
  if (!expiryDate) return null;
  return Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function isNearExpiry(expiryDate: Date | null, withinDays = 30): boolean {
  const days = daysToExpiry(expiryDate);
  return days != null && days >= 0 && days <= withinDays;
}

/** FEFO/FIFO batch pick order */
export function sortBatchesForIssue(
  batches: BatchForFefo[],
  policy: StockRotationPolicy,
): BatchForFefo[] {
  return [...batches].sort((a, b) => {
    if (policy === "FEFO") {
      const ae = a.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const be = b.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
      if (ae !== be) return ae - be;
    }
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
}

export function computeWeightedAverageCost(batches: { quantity: number; landedCost: number | null; unitCost?: number }[]): number {
  let totalQty = 0;
  let totalCost = 0;
  for (const b of batches) {
    const cost = b.landedCost ?? b.unitCost ?? 0;
    totalQty += b.quantity;
    totalCost += b.quantity * cost;
  }
  return totalQty > 0 ? Math.round((totalCost / totalQty) * 100) / 100 : 0;
}

export function computeFifoCost(batches: BatchForFefo[], qty: number, defaultCost: number): number {
  const sorted = sortBatchesForIssue(batches, "FIFO");
  let remaining = qty;
  let total = 0;
  for (const b of sorted) {
    if (remaining <= 0) break;
    const available = Math.max(0, b.quantity - b.reservedQty);
    const take = Math.min(available, remaining);
    total += take * (b.landedCost ?? defaultCost);
    remaining -= take;
  }
  return qty > 0 ? Math.round((total / qty) * 100) / 100 : defaultCost;
}

export function valueInventory(
  stockQty: number,
  costPrice: number,
  batches: BatchForFefo[],
  method: InventoryValuationMethod,
): number {
  if (method === "WEIGHTED_AVERAGE") {
    const avg = computeWeightedAverageCost(
      batches.map((b) => ({ quantity: b.quantity, landedCost: b.landedCost })),
    );
    return Math.round(stockQty * (avg || costPrice) * 100) / 100;
  }
  if (method === "LANDED_COST") {
    const avg = computeWeightedAverageCost(
      batches.map((b) => ({ quantity: b.quantity, landedCost: b.landedCost ?? costPrice * 1.08 })),
    );
    return Math.round(stockQty * avg * 100) / 100;
  }
  return Math.round(stockQty * computeFifoCost(batches, stockQty, costPrice) * 100) / 100;
}

export function forecastDemand(historical: number[], growthPct = 5): number {
  if (historical.length === 0) return 0;
  const recent = historical.slice(-3);
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  return Math.round(avg * (1 + growthPct / 100));
}

export function shouldTriggerReorder(availableQty: number, reorderPoint: number, safetyStock: number): boolean {
  return availableQty <= reorderPoint || availableQty <= safetyStock;
}

export function buildInventoryBarcode(sku: string, batchNumber: string): string {
  return `INV-${sku}-${batchNumber}`.replace(/\s/g, "").slice(0, 24).toUpperCase();
}
