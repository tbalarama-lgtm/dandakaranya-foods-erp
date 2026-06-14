import type { BatchInventoryStatus, StorageZoneType } from "@prisma/client";

export function computeUtilizationPct(used: number, capacity: number): number {
  if (capacity <= 0) return used > 0 ? 100 : 0;
  return Math.round((used / capacity) * 1000) / 10;
}

export function computePalletUtilization(usedPallets: number, palletCapacity: number): number {
  return computeUtilizationPct(usedPallets, palletCapacity);
}

export function isOverflow(utilizationPct: number, threshold = 90): boolean {
  return utilizationPct >= threshold;
}

export function computeDispatchEfficiency(dispatched: number, total: number): number {
  if (total <= 0) return 100;
  return Math.round((dispatched / total) * 1000) / 10;
}

export function computeTurnoverDays(inventoryValue: number, cogsProxy: number): number {
  if (cogsProxy <= 0) return 0;
  const dailyCogs = cogsProxy / 30;
  return dailyCogs > 0 ? Math.round((inventoryValue / dailyCogs) * 10) / 10 : 0;
}

export function computeStockAgeDays(createdAt: Date): number {
  return Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
}

export function bucketStockAge(days: number): "0-30" | "31-60" | "61-90" | "90+" {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

export function sortFefoBatches<T extends { expiryDate: Date | null; mfgDate: Date | null }>(batches: T[]): T[] {
  return [...batches].sort((a, b) => {
    const ae = a.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    const be = b.expiryDate?.getTime() ?? Number.MAX_SAFE_INTEGER;
    if (ae !== be) return ae - be;
    const am = a.mfgDate?.getTime() ?? 0;
    const bm = b.mfgDate?.getTime() ?? 0;
    return am - bm;
  });
}

export function isQuarantineStatus(status: BatchInventoryStatus): boolean {
  return status === "QUARANTINE" || status === "REJECTED";
}

export function isColdZone(zoneType: StorageZoneType): boolean {
  return zoneType === "COLD_STORAGE";
}

export function isEnvironmentInRange(
  temp: number | null,
  humidity: number | null,
  tempMin: number | null,
  tempMax: number | null,
  humidityMin: number | null,
  humidityMax: number | null,
): boolean {
  if (temp != null && tempMin != null && temp < tempMin) return false;
  if (temp != null && tempMax != null && temp > tempMax) return false;
  if (humidity != null && humidityMin != null && humidity < humidityMin) return false;
  if (humidity != null && humidityMax != null && humidity > humidityMax) return false;
  return true;
}

export function forecastReplenishment(
  demandForecast: number,
  currentStock: number,
  safetyStock: number,
): number {
  const gap = demandForecast + safetyStock - currentStock;
  return Math.max(0, Math.round(gap * 100) / 100);
}

export function aiOptimizeReplenishment(
  demandForecast: number,
  currentStock: number,
  safetyStock: number,
  utilizationPct: number,
): number {
  const base = forecastReplenishment(demandForecast, currentStock, safetyStock);
  const utilizationFactor = utilizationPct > 85 ? 1.15 : utilizationPct < 50 ? 0.9 : 1;
  return Math.round(base * utilizationFactor * 100) / 100;
}

export function generateTransferNumber(seq: number): string {
  return `WT-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

export function generateDispatchNumber(seq: number): string {
  return `PPD-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

export function generateDockAppointmentNo(seq: number): string {
  return `DOCK-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

export function generateBarcode(prefix: string, code: string): string {
  return `${prefix}-${code}`.toUpperCase().replace(/\s+/g, "-");
}
