import type { ProductionStage } from "@prisma/client";
import { STAGE_ORDER } from "@/lib/production-types";

export type RecipeLineInput = { productId: string; quantity: number; unit: string; scrapPct?: number };
export type StockMap = Map<string, { stockQty: number; reserved: number }>;

export function computeOee(availability: number, performance: number, quality: number): number {
  return Math.round((availability / 100) * (performance / 100) * (quality / 100) * 1000) / 10;
}

export function computeYieldPct(actualQty: number, plannedQty: number, inputQty?: number): number {
  if (inputQty && inputQty > 0) return Math.round((actualQty / inputQty) * 1000) / 10;
  if (plannedQty <= 0) return 0;
  return Math.round((actualQty / plannedQty) * 1000) / 10;
}

export function computeWastage(plannedQty: number, actualQty: number, recoveryQty = 0): number {
  return Math.max(0, plannedQty - actualQty - recoveryQty);
}

export function computeMachineUtilization(runtimeMin: number, availableMin: number): number {
  if (availableMin <= 0) return 0;
  return Math.round((runtimeMin / availableMin) * 1000) / 10;
}

export function explodeBom(
  lines: RecipeLineInput[],
  plannedOutputQty: number,
  recipeYieldQty: number,
): { productId: string; requiredQty: number; unit: string }[] {
  if (recipeYieldQty <= 0) return [];
  const factor = plannedOutputQty / recipeYieldQty;
  return lines.map((l) => ({
    productId: l.productId,
    requiredQty: Math.round(l.quantity * factor * (1 + (l.scrapPct ?? 0) / 100) * 1000) / 1000,
    unit: l.unit,
  }));
}

export function computeShortage(requiredQty: number, availableQty: number): number {
  return Math.max(0, Math.round((requiredQty - availableQty) * 1000) / 1000);
}

export function nextStage(current: ProductionStage | null): ProductionStage | null {
  if (!current) return STAGE_ORDER[0] ?? null;
  const idx = STAGE_ORDER.indexOf(current);
  return idx >= 0 && idx < STAGE_ORDER.length - 1 ? STAGE_ORDER[idx + 1]! : null;
}

export function isBatchDelayed(scheduledEnd: Date | null, status: string): boolean {
  if (!scheduledEnd) return false;
  if (["COMPLETED", "CANCELLED", "REJECTED"].includes(status)) return false;
  return scheduledEnd.getTime() < Date.now();
}

export function predictBottleneckScore(utilizationPct: number, shortageCount: number, delayedCount: number): number {
  const base = utilizationPct * 0.5 + shortageCount * 8 + delayedCount * 12;
  return Math.min(100, Math.round(base));
}

export function aiOptimizeSchedule(
  slots: { scheduledStart: Date; scheduledEnd: Date; machineId: string | null }[],
  machineCapacityKgPerHour: number,
): { shiftMinutes: number; suggestedGapMin: number } {
  const durations = slots.map((s) => (s.scheduledEnd.getTime() - s.scheduledStart.getTime()) / 60000);
  const total = durations.reduce((a, b) => a + b, 0);
  const gap = machineCapacityKgPerHour > 200 ? 15 : 30;
  return { shiftMinutes: Math.round(total), suggestedGapMin: gap };
}

export function generateWorkOrderNumber(seq: number): string {
  return `WO-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

export function generateBatchCode(seq: number): string {
  return `PRD-${new Date().getFullYear()}-${String(seq).padStart(3, "0")}`;
}

export function generateMaintenanceNumber(seq: number): string {
  return `PM-${new Date().getFullYear()}-${String(seq).padStart(4, "0")}`;
}

export function batchTotalCost(
  material: number,
  labor: number,
  machine: number,
  utility: number,
): number {
  return Math.round((material + labor + machine + utility) * 100) / 100;
}
