import type {
  GRNItemQcStatus,
  GRNStatus,
  ProcurementApprovalState,
  ProcurementApprovalType,
  ProcurementStage,
  RFQStatus,
  TamarindGrade,
  VendorClassification,
} from "@prisma/client";

export const LIFECYCLE_STAGES: ProcurementStage[] = [
  "DRAFT",
  "RFQ",
  "PO_ISSUED",
  "GRN_RECEIVED",
  "QUALITY_CHECK",
  "BILLED",
  "PAID",
];

export const LIFECYCLE_LABELS: Record<ProcurementStage, string> = {
  DRAFT: "Draft",
  RFQ: "RFQ",
  PO_ISSUED: "Purchase Order",
  GRN_RECEIVED: "GRN",
  QUALITY_CHECK: "Quality Check",
  BILLED: "Bill",
  PAID: "Payment",
  CANCELLED: "Cancelled",
};

export const LIFECYCLE_STYLES: Record<ProcurementStage, string> = {
  DRAFT: "bg-slate-500/12 text-slate-600",
  RFQ: "bg-violet-500/12 text-violet-700",
  PO_ISSUED: "bg-sky-500/12 text-sky-700",
  GRN_RECEIVED: "bg-indigo-500/12 text-indigo-700",
  QUALITY_CHECK: "bg-amber-500/12 text-amber-800",
  BILLED: "bg-orange-500/12 text-orange-700",
  PAID: "bg-emerald-500/12 text-emerald-700",
  CANCELLED: "bg-red-500/12 text-red-600",
};

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

export const GRN_STATUS_LABELS: Record<GRNStatus, string> = {
  PENDING: "Pending",
  PARTIAL: "Partial",
  RECEIVED: "Received",
  REJECTED: "Rejected",
  QC_HOLD: "QC Hold",
};

export const QC_STATUS_LABELS: Record<GRNItemQcStatus, string> = {
  PENDING: "Pending",
  PASSED: "Passed",
  FAILED: "Failed",
  HOLD: "On hold",
};

export type LifecycleStep = {
  stage: ProcurementStage;
  label: string;
  count: number;
  value: number;
  href?: string;
};

export type ProcurementHubKpis = {
  totalPos: number;
  activeRfqs: number;
  pendingApprovals: number;
  pendingGrns: number;
  qcHolds: number;
  outstandingPayables: number;
  overduePayables: number;
  spendThisMonth: number;
  spendLastMonth: number;
  budgetUtilizationPct: number;
  budgetAlerts: number;
  onTimeDeliveryPct: number;
  avgQualityScore: number;
  avgRejectionRate: number;
  expiringContracts: number;
};

export type SpendTrendPoint = { month: string; spend: number; forecast?: number; budget?: number };

export type CategorySpend = {
  classification: VendorClassification;
  label: string;
  spend: number;
  count: number;
  budget?: number;
};

export type VendorComparisonRow = {
  vendorId: string;
  vendorName: string;
  spend: number;
  poCount: number;
  onTimePct: number;
  qualityScore: number;
  rejectionRate: number;
  avgUnitPrice: number;
  rank: number;
};

export type PayableAgingBucket = {
  bucket: string;
  count: number;
  amount: number;
};

export type PayableRow = {
  id: string;
  purchaseNumber: string;
  vendorName: string;
  vendorId: string;
  total: number;
  paid: number;
  balance: number;
  dueDate: string | null;
  daysOverdue: number;
  stage: ProcurementStage;
  paymentStatus: string;
};

export type GrnListRow = {
  id: string;
  grnNumber: string;
  purchaseNumber: string;
  vendorName: string;
  vendorId: string;
  status: GRNStatus;
  warehouseName: string | null;
  receivedAt: string | null;
  moisturePct: number | null;
  tamarindGrade: TamarindGrade | null;
  qcPassed: boolean;
  itemCount: number;
  orderedQty: number;
  receivedQty: number;
  damagedQty: number;
};

export type ApprovalRow = {
  purchaseId: string;
  purchaseNumber: string;
  vendorName: string;
  total: number;
  stage: ProcurementStage;
  procurement: ProcurementApprovalState;
  finance: ProcurementApprovalState;
  inventory: ProcurementApprovalState;
  budget: ProcurementApprovalState;
};

export type BudgetRow = {
  id: string;
  label: string;
  fiscalYear: number;
  month: number | null;
  classification: VendorClassification | null;
  budgetAmount: number;
  spentAmount: number;
  utilizationPct: number;
  isOverBudget: boolean;
  isAlert: boolean;
};

export type ForecastPoint = { month: string; actual: number; forecast: number };

export type ProcurementHubAnalytics = {
  kpis: ProcurementHubKpis;
  lifecycle: LifecycleStep[];
  spendTrend: SpendTrendPoint[];
  categorySpend: CategorySpend[];
  vendorComparison: VendorComparisonRow[];
  payablesAging: PayableAgingBucket[];
  topPayables: PayableRow[];
  allPayables?: PayableRow[];
  forecast: ForecastPoint[];
  seasonalInsight: string;
};

export { RFQ_STATUS_LABELS, RFQ_STATUS_STYLES } from "@/lib/rfq-types";

export type { RfqComparisonMatrixRow as RfqComparisonQuote } from "@/lib/rfq-types";
