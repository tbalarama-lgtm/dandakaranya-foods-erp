import type { BudgetEnforcementLevel, BudgetUtilizationTier } from "@prisma/client";
import type { BudgetEnforcementResult } from "@/lib/budget-types";
import {
  DEFAULT_CRITICAL_THRESHOLD,
  DEFAULT_LOCK_THRESHOLD,
  DEFAULT_WARNING_THRESHOLD,
} from "@/lib/budget-types";

export type BudgetThresholds = {
  warning: number;
  critical: number;
  lock: number;
};

export type BudgetSnapshot = {
  budgetAmount: number;
  spentAmount: number;
  committedAmount: number;
  status: string;
  enforcementLevel: BudgetEnforcementLevel;
  thresholds: BudgetThresholds;
};

export function computeTotalUsed(spent: number, committed: number): number {
  return spent + committed;
}

export function computeUtilizationPct(totalUsed: number, budgetAmount: number): number {
  if (budgetAmount <= 0) return totalUsed > 0 ? 100 : 0;
  return Math.round((totalUsed / budgetAmount) * 1000) / 10;
}

export function computeRemaining(budgetAmount: number, totalUsed: number): number {
  return Math.max(0, budgetAmount - totalUsed);
}

export function getUtilizationTier(
  utilizationPct: number,
  thresholds: BudgetThresholds = {
    warning: DEFAULT_WARNING_THRESHOLD,
    critical: DEFAULT_CRITICAL_THRESHOLD,
    lock: DEFAULT_LOCK_THRESHOLD,
  },
): BudgetUtilizationTier {
  if (utilizationPct >= thresholds.lock) return "LOCKED";
  if (utilizationPct >= thresholds.critical) return "CRITICAL";
  if (utilizationPct >= thresholds.warning) return "WARNING";
  return "HEALTHY";
}

export function resolveEnforcementAction(
  tier: BudgetUtilizationTier,
  enforcementLevel: BudgetEnforcementLevel,
  isLocked: boolean,
): BudgetEnforcementResult["action"] {
  if (isLocked || tier === "LOCKED") return "LOCK";
  if (enforcementLevel === "NONE") return "NONE";
  if (tier === "CRITICAL") {
    if (enforcementLevel === "LOCK") return "LOCK";
    if (enforcementLevel === "ESCALATE") return "ESCALATE";
    return "WARN";
  }
  if (tier === "WARNING") {
    if (enforcementLevel === "WARN") return "WARN";
    if (enforcementLevel === "ESCALATE" || enforcementLevel === "LOCK") return "WARN";
  }
  return "NONE";
}

export function validateBudgetCommit(
  budget: BudgetSnapshot,
  poAmount: number,
): BudgetEnforcementResult {
  const projectedUsed = computeTotalUsed(budget.spentAmount, budget.committedAmount) + poAmount;
  const utilizationPct = computeUtilizationPct(projectedUsed, budget.budgetAmount);
  const tier = getUtilizationTier(utilizationPct, budget.thresholds);
  const isLocked = budget.status === "LOCKED";
  const action = resolveEnforcementAction(tier, budget.enforcementLevel, isLocked);
  const requiresOverspendApproval = tier === "CRITICAL" || tier === "LOCKED";

  let message = "Within budget limits";
  if (tier === "WARNING") message = `Budget utilization will reach ${utilizationPct}% — warning threshold (70%) breached`;
  if (tier === "CRITICAL") message = `Critical alert: ${utilizationPct}% utilization — finance escalation required`;
  if (tier === "LOCKED" || isLocked) message = `Budget lock active at ${utilizationPct}% — new PO commitments blocked`;
  if (isLocked) message = `Budget is locked: ${budget.status}`;

  return {
    allowed: action !== "LOCK" && !isLocked,
    tier,
    utilizationPct,
    action,
    message,
    requiresOverspendApproval,
  };
}

/** AI-style spend forecast using weighted moving average + seasonal uplift */
export function forecastSpend(
  historicalMonthly: number[],
  opts?: { seasonalFactor?: number; inflationPct?: number; scenario?: "OPTIMISTIC" | "EXPECTED" | "INFLATION_ADJUSTED" },
): number {
  if (historicalMonthly.length === 0) return 0;
  const recent = historicalMonthly.slice(-6);
  const weights = recent.map((_, i) => i + 1);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const weightedAvg = recent.reduce((sum, v, i) => sum + v * weights[i], 0) / weightSum;

  let forecast = weightedAvg;
  const seasonal = opts?.seasonalFactor ?? 1;
  const inflation = (opts?.inflationPct ?? 0) / 100;

  if (opts?.scenario === "OPTIMISTIC") forecast *= 0.92 * seasonal;
  else if (opts?.scenario === "INFLATION_ADJUSTED") forecast *= (1 + inflation) * seasonal;
  else forecast *= seasonal;

  return Math.round(forecast);
}

export function computeVariance(planned: number, actual: number): { variance: number; variancePct: number } {
  const variance = actual - planned;
  const variancePct = planned > 0 ? Math.round((variance / planned) * 1000) / 10 : 0;
  return { variance, variancePct };
}

export function computeProcurementEfficiency(
  onTimePos: number,
  totalPos: number,
  avgQualityScore: number,
): number {
  if (totalPos === 0) return 100;
  const onTimePct = (onTimePos / totalPos) * 100;
  return Math.round((onTimePct * 0.6 + avgQualityScore * 0.4) * 10) / 10;
}
