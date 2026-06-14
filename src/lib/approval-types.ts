import type {
  ApprovalWorkflowAction,
  ProcurementApprovalState,
  ProcurementApprovalType,
  ProcurementStage,
  VendorClassification,
} from "@prisma/client";

export const CORE_APPROVAL_LEVELS: ProcurementApprovalType[] = [
  "PROCUREMENT",
  "FINANCE",
  "INVENTORY",
  "BUDGET",
];

export const EXTENDED_APPROVAL_LEVELS: ProcurementApprovalType[] = [
  "QUALITY_CONTROL",
  "COMPLIANCE",
  "SUPPLIER_CERTIFICATION",
  "SEASONAL_PROCUREMENT",
];

export const ALL_APPROVAL_LEVELS: ProcurementApprovalType[] = [
  ...CORE_APPROVAL_LEVELS,
  ...EXTENDED_APPROVAL_LEVELS,
];

export const APPROVAL_TYPE_LABELS: Record<ProcurementApprovalType, string> = {
  PROCUREMENT: "Procurement",
  FINANCE: "Finance",
  INVENTORY: "Inventory",
  BUDGET: "Budget",
  QUALITY_CONTROL: "Quality Control",
  COMPLIANCE: "Compliance",
  SUPPLIER_CERTIFICATION: "Supplier Certification",
  SEASONAL_PROCUREMENT: "Seasonal Procurement",
};

export const APPROVAL_STATE_LABELS: Record<ProcurementApprovalState, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  SENT_BACK: "Sent Back",
  ESCALATED: "Escalated",
};

export const APPROVAL_STATE_STYLES: Record<ProcurementApprovalState, string> = {
  PENDING: "bg-amber-500/12 text-amber-800",
  APPROVED: "bg-emerald-500/12 text-emerald-700",
  REJECTED: "bg-red-500/12 text-red-700",
  SENT_BACK: "bg-orange-500/12 text-orange-800",
  ESCALATED: "bg-violet-500/12 text-violet-700",
};

export const APPROVAL_ACTION_LABELS: Record<ApprovalWorkflowAction, string> = {
  APPROVE: "Approved",
  REJECT: "Rejected",
  SEND_BACK: "Sent Back",
  ESCALATE: "Escalated",
  COMMENT: "Comment",
  DELEGATE: "Delegated",
  AUTO_ESCALATE: "Auto-Escalated",
  QC_GATE: "QC Gate",
  COMPLIANCE_CHECK: "Compliance Check",
  BUDGET_VALIDATE: "Budget Validated",
  SEASONAL_REVIEW: "Seasonal Review",
};

export type ApprovalLevelSnapshot = {
  type: ProcurementApprovalType;
  status: ProcurementApprovalState;
  approverName: string | null;
  approvedAt: string | null;
  dueAt: string | null;
  isOverdue: boolean;
  notes: string | null;
};

export type ApprovalWorkflowRow = {
  purchaseId: string;
  purchaseNumber: string;
  vendorName: string;
  vendorId: string;
  classification: VendorClassification;
  department: string | null;
  total: number;
  budgetAmount: number | null;
  stage: ProcurementStage;
  levels: ApprovalLevelSnapshot[];
  progressPct: number;
  pendingCount: number;
  overdueCount: number;
  escalatedCount: number;
  budgetStatus: "OK" | "ALERT" | "OVERSPEND";
  budgetVariancePct: number | null;
  oldestPendingHours: number | null;
  requiresQc: boolean;
  requiresCompliance: boolean;
  isSeasonal: boolean;
  supplierCertOk: boolean;
};

export type ApprovalHubKpis = {
  totalInWorkflow: number;
  myPending: number;
  fullyApproved: number;
  blocked: number;
  overdue: number;
  escalated: number;
  avgTurnaroundHours: number;
  slaCompliancePct: number;
  openValue: number;
  budgetAlerts: number;
  bottleneckLevel: ProcurementApprovalType | null;
};

export type ApprovalTimelineEvent = {
  id: string;
  action: ApprovalWorkflowAction;
  title: string;
  detail: string | null;
  comment: string | null;
  approvalType: ProcurementApprovalType | null;
  actorName: string | null;
  createdAt: string;
  metadata: Record<string, unknown> | null;
};

export type ApprovalCommentDto = {
  id: string;
  body: string;
  userName: string;
  approvalType: ProcurementApprovalType | null;
  createdAt: string;
};

export type ApprovalDetail = {
  row: ApprovalWorkflowRow;
  timeline: ApprovalTimelineEvent[];
  comments: ApprovalCommentDto[];
  budgetAnalysis: {
    poTotal: number;
    budgetCap: number | null;
    departmentBudget: number | null;
    departmentSpent: number | null;
    variancePct: number | null;
    status: "OK" | "ALERT" | "OVERSPEND";
    message: string;
  };
  matrixRuleName: string | null;
  requiredLevels: ProcurementApprovalType[];
};

export type ApprovalBottleneck = {
  level: ProcurementApprovalType;
  pendingCount: number;
  avgHours: number;
  overdueCount: number;
};

export type ApprovalSlaPoint = {
  month: string;
  avgHours: number;
  overdue: number;
  completed: number;
};

export type ApprovalMatrixRuleDto = {
  id: string;
  name: string;
  minPoValue: number | null;
  maxPoValue: number | null;
  department: string | null;
  classification: VendorClassification | null;
  requiredLevels: ProcurementApprovalType[];
  escalateAbove: number | null;
  slaHours: number;
  requiresQc: boolean;
  requiresCompliance: boolean;
  seasonalOnly: boolean;
};
