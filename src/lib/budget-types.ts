import type {
  BudgetApprovalType,
  BudgetAuditAction,
  BudgetEnforcementLevel,
  BudgetLifecycleStatus,
  BudgetScenarioType,
  BudgetUtilizationTier,
  ProcurementApprovalState,
  VendorClassification,
} from "@prisma/client";

export const DEFAULT_WARNING_THRESHOLD = 70;
export const DEFAULT_CRITICAL_THRESHOLD = 90;
export const DEFAULT_LOCK_THRESHOLD = 100;

export const BUDGET_STATUS_LABELS: Record<BudgetLifecycleStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  ACTIVE: "Active",
  LOCKED: "Locked",
  REVISED: "Revised",
  ARCHIVED: "Archived",
};

export const BUDGET_STATUS_STYLES: Record<BudgetLifecycleStatus, string> = {
  DRAFT: "bg-slate-500/12 text-slate-600",
  PENDING_APPROVAL: "bg-amber-500/12 text-amber-800",
  ACTIVE: "bg-emerald-500/12 text-emerald-700",
  LOCKED: "bg-red-500/12 text-red-700",
  REVISED: "bg-violet-500/12 text-violet-700",
  ARCHIVED: "bg-gray-500/12 text-gray-600",
};

export const BUDGET_SCENARIO_LABELS: Record<BudgetScenarioType, string> = {
  OPTIMISTIC: "Optimistic",
  EXPECTED: "Expected",
  INFLATION_ADJUSTED: "Inflation-adjusted",
};

export const BUDGET_TIER_LABELS: Record<BudgetUtilizationTier, string> = {
  HEALTHY: "Healthy",
  WARNING: "Warning (70%+)",
  CRITICAL: "Critical (90%+)",
  LOCKED: "Locked (100%+)",
};

export const BUDGET_TIER_STYLES: Record<BudgetUtilizationTier, string> = {
  HEALTHY: "bg-emerald-500/12 text-emerald-700",
  WARNING: "bg-amber-500/12 text-amber-800",
  CRITICAL: "bg-orange-500/12 text-orange-800",
  LOCKED: "bg-red-500/12 text-red-700",
};

export const BUDGET_APPROVAL_LABELS: Record<BudgetApprovalType, string> = {
  CREATION: "Budget creation",
  REVISION: "Budget revision",
  OVERSPEND: "Overspend approval",
};

export const BUDGET_AUDIT_LABELS: Record<BudgetAuditAction, string> = {
  CREATED: "Created",
  REVISED: "Revised",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  LOCKED: "Locked",
  UNLOCKED: "Unlocked",
  THRESHOLD_BREACH: "Threshold breach",
  PO_COMMITTED: "PO committed",
  PO_RELEASED: "PO released",
  FORECAST_UPDATED: "Forecast updated",
  ALERT_SENT: "Alert sent",
  SCENARIO_UPDATED: "Scenario updated",
};

export type BudgetEnforcementResult = {
  allowed: boolean;
  tier: BudgetUtilizationTier;
  utilizationPct: number;
  action: "NONE" | "WARN" | "ESCALATE" | "LOCK";
  message: string;
  requiresOverspendApproval: boolean;
};

export type BudgetGovernanceRow = {
  id: string;
  label: string;
  fiscalYear: number;
  month: number | null;
  classification: VendorClassification | null;
  department: string | null;
  region: string | null;
  warehouseName: string | null;
  branchName: string | null;
  budgetAmount: number;
  spentAmount: number;
  committedAmount: number;
  totalUsed: number;
  remaining: number;
  forecastAmount: number | null;
  utilizationPct: number;
  tier: BudgetUtilizationTier;
  status: BudgetLifecycleStatus;
  enforcementLevel: BudgetEnforcementLevel;
  scenario: BudgetScenarioType;
  seasonalFlag: boolean;
  fpoAllocationPct: number | null;
  packagingForecast: number | null;
  logisticsForecast: number | null;
  yieldBudgetPct: number | null;
  variancePct: number | null;
  plannedVsActualPct: number | null;
  poCount: number;
  isLocked: boolean;
  pendingApprovals: number;
};

export type BudgetHubKpis = {
  totalBudget: number;
  totalSpent: number;
  totalCommitted: number;
  totalRemaining: number;
  avgUtilizationPct: number;
  warningCount: number;
  criticalCount: number;
  lockedCount: number;
  overspendCount: number;
  pendingApprovals: number;
  seasonalBudgets: number;
  fpoAllocationTotal: number;
  forecastAccuracyPct: number;
  procurementEfficiencyPct: number;
};

export type BudgetVariancePoint = {
  month: string;
  planned: number;
  actual: number;
  variance: number;
  variancePct: number;
};

export type BudgetScenarioForecast = {
  scenario: BudgetScenarioType;
  label: string;
  totalForecast: number;
  monthly: { month: string; amount: number }[];
};

export type BudgetCategoryAllocation = {
  classification: VendorClassification;
  label: string;
  budget: number;
  spent: number;
  committed: number;
  utilizationPct: number;
  tier: BudgetUtilizationTier;
};

export type BudgetAuditEntry = {
  id: string;
  budgetId: string;
  budgetLabel: string;
  action: BudgetAuditAction;
  title: string;
  detail: string | null;
  actorName: string | null;
  createdAt: string;
};

export type BudgetApprovalRow = {
  id: string;
  budgetId: string;
  budgetLabel: string;
  approvalType: BudgetApprovalType;
  status: ProcurementApprovalState;
  approverName: string | null;
  createdAt: string;
};

export type BudgetPoLink = {
  purchaseId: string;
  purchaseNumber: string;
  vendorName: string;
  amount: number;
  status: string;
  committedAt: string;
};

export type BudgetDetail = {
  row: BudgetGovernanceRow;
  revisions: { revisionNumber: number; previousAmount: number; newAmount: number; reason: string | null; createdAt: string }[];
  auditLog: BudgetAuditEntry[];
  approvals: BudgetApprovalRow[];
  poLinks: BudgetPoLink[];
  varianceTrend: BudgetVariancePoint[];
  scenarioForecasts: BudgetScenarioForecast[];
};

export type BudgetHubBundle = {
  rows: BudgetGovernanceRow[];
  kpis: BudgetHubKpis;
  categoryAllocation: BudgetCategoryAllocation[];
  varianceTrend: BudgetVariancePoint[];
  scenarioForecasts: BudgetScenarioForecast[];
  recentAudit: BudgetAuditEntry[];
  pendingApprovals: BudgetApprovalRow[];
  multiYearPlans: { id: string; name: string; startYear: number; endYear: number; totalPlanned: number; scenario: BudgetScenarioType }[];
};
