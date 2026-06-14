import type {
  ComplianceStandard,
  GRNItemQcStatus,
  GRNStatus,
  GrnLifecycleStatus,
  QcInspectionStep,
  StockRotationPolicy,
  TamarindGrade,
  VendorReturnStatus,
} from "@prisma/client";

export const GRN_LIFECYCLE: GrnLifecycleStatus[] = [
  "DELIVERY_RECEIVED",
  "GRN_CREATED",
  "QC_INSPECTION",
  "QC_APPROVED",
  "QC_REJECTED",
  "QUARANTINE",
  "WAREHOUSE_ALLOCATED",
  "STOCK_UPDATED",
  "RETURNED_TO_VENDOR",
];

export const GRN_LIFECYCLE_LABELS: Record<GrnLifecycleStatus, string> = {
  DELIVERY_RECEIVED: "Delivery received",
  GRN_CREATED: "GRN created",
  QC_INSPECTION: "QC inspection",
  QC_APPROVED: "QC approved",
  QC_REJECTED: "QC rejected",
  QUARANTINE: "Quarantine",
  WAREHOUSE_ALLOCATED: "Warehouse allocated",
  STOCK_UPDATED: "Stock updated",
  RETURNED_TO_VENDOR: "Returned to vendor",
};

export const GRN_LIFECYCLE_STYLES: Record<GrnLifecycleStatus, string> = {
  DELIVERY_RECEIVED: "bg-sky-500/12 text-sky-700",
  GRN_CREATED: "bg-indigo-500/12 text-indigo-700",
  QC_INSPECTION: "bg-amber-500/12 text-amber-800",
  QC_APPROVED: "bg-emerald-500/12 text-emerald-700",
  QC_REJECTED: "bg-red-500/12 text-red-700",
  QUARANTINE: "bg-orange-500/12 text-orange-800",
  WAREHOUSE_ALLOCATED: "bg-violet-500/12 text-violet-700",
  STOCK_UPDATED: "bg-teal-500/12 text-teal-700",
  RETURNED_TO_VENDOR: "bg-slate-500/12 text-slate-600",
};

export const GRN_STATUS_LABELS: Record<GRNStatus, string> = {
  PENDING: "Pending",
  PARTIAL: "Partial",
  RECEIVED: "Received",
  REJECTED: "Rejected",
  QC_HOLD: "QC hold",
};

export const QC_ITEM_STATUS_LABELS: Record<GRNItemQcStatus, string> = {
  PENDING: "Pending",
  PASSED: "Passed",
  FAILED: "Failed",
  HOLD: "Hold",
};

export const QC_STEP_LABELS: Record<QcInspectionStep, string> = {
  SAMPLE_COLLECTION: "Sample collection",
  INSPECTION: "Inspection",
  APPROVAL: "Approval",
  REJECTION: "Rejection",
  QUARANTINE: "Quarantine",
  WAREHOUSE_RELEASE: "Warehouse release",
};

export const ROTATION_LABELS: Record<StockRotationPolicy, string> = {
  FIFO: "FIFO (First In, First Out)",
  FEFO: "FEFO (First Expiry, First Out)",
};

export const COMPLIANCE_LABELS: Record<ComplianceStandard, string> = {
  FSSAI: "FSSAI",
  HACCP: "HACCP",
  ISO_22000: "ISO 22000",
};

export const RETURN_STATUS_LABELS: Record<VendorReturnStatus, string> = {
  DRAFT: "Draft",
  PENDING: "Pending",
  APPROVED: "Approved",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const GRN_WORKFLOW_STEPS = [
  { key: "DELIVERY", label: "Delivery" },
  { key: "GRN", label: "GRN" },
  { key: "QC", label: "QC" },
  { key: "ALLOC", label: "Allocate" },
  { key: "STOCK", label: "Stock" },
] as const;

export const TAMARIND_QC_THRESHOLDS = {
  moistureMax: 12,
  seedRatioMax: 18,
  pulpYieldMin: 38,
  foreignMatterMax: 1,
  acidityMin: 2.5,
} as const;

export const GRN_SEASONAL_INSIGHT =
  "Monsoon intake: quarantine lots with moisture >12% until re-drying. Grade A Bastar tamarind target — seed ratio ≤18%, pulp yield ≥38%, foreign matter <1%.";

export function evaluateQcAgainstThresholds(params: {
  moisturePct?: number | null;
  seedRatioPct?: number | null;
  pulpYieldPct?: number | null;
  foreignMatterPct?: number | null;
}): { passed: boolean; alerts: string[] } {
  const alerts: string[] = [];
  if (params.moisturePct != null && params.moisturePct > TAMARIND_QC_THRESHOLDS.moistureMax) {
    alerts.push(`Moisture ${params.moisturePct}% exceeds max ${TAMARIND_QC_THRESHOLDS.moistureMax}%`);
  }
  if (params.seedRatioPct != null && params.seedRatioPct > TAMARIND_QC_THRESHOLDS.seedRatioMax) {
    alerts.push(`Seed ratio ${params.seedRatioPct}% exceeds max ${TAMARIND_QC_THRESHOLDS.seedRatioMax}%`);
  }
  if (params.pulpYieldPct != null && params.pulpYieldPct < TAMARIND_QC_THRESHOLDS.pulpYieldMin) {
    alerts.push(`Pulp yield ${params.pulpYieldPct}% below min ${TAMARIND_QC_THRESHOLDS.pulpYieldMin}%`);
  }
  if (params.foreignMatterPct != null && params.foreignMatterPct > TAMARIND_QC_THRESHOLDS.foreignMatterMax) {
    alerts.push(`Foreign matter ${params.foreignMatterPct}% exceeds max ${TAMARIND_QC_THRESHOLDS.foreignMatterMax}%`);
  }
  return { passed: alerts.length === 0, alerts };
}

export type GrnListRow = {
  id: string;
  grnNumber: string;
  purchaseNumber: string;
  purchaseId: string;
  vendorName: string;
  vendorId: string;
  status: GRNStatus;
  lifecycle: GrnLifecycleStatus;
  warehouseName: string | null;
  receivedAt: string | null;
  moisturePct: number | null;
  tamarindGrade: TamarindGrade | null;
  qcPassed: boolean;
  stockUpdated: boolean;
  intakeValue: number;
  itemCount: number;
  orderedQty: number;
  receivedQty: number;
  damagedQty: number;
  rejectedQty: number;
  pendingQcItems: number;
  isQuarantine: boolean;
};

export type GrnExecutionKpis = {
  totalGrns: number;
  pendingInspections: number;
  rejectedBatches: number;
  quarantineCount: number;
  intakeValue: number;
  avgVendorQuality: number;
  pendingStockPost: number;
  returnsOpen: number;
};

export type GrnLineItemDto = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  orderedQty: number;
  receivedQty: number;
  damagedQty: number;
  rejectedQty: number;
  quarantineQty: number;
  acceptedQty: number;
  supplierBatch: string | null;
  warehouseBatch: string | null;
  moisturePct: number | null;
  acidityPct: number | null;
  pulpYieldPct: number | null;
  seedRatioPct: number | null;
  foreignMatterPct: number | null;
  microbialPass: boolean | null;
  tamarindGrade: TamarindGrade | null;
  qcStatus: GRNItemQcStatus;
  binCode: string | null;
  expiryDate: string | null;
  traceCode: string | null;
  barcodeData: string | null;
  qrCodeData: string | null;
};

export type GrnInspectionDto = {
  id: string;
  step: QcInspectionStep;
  sampleRef: string | null;
  passed: boolean | null;
  moisturePct: number | null;
  tamarindGrade: TamarindGrade | null;
  officerName: string | null;
  completedAt: string;
  notes: string | null;
};

export type GrnEventDto = {
  id: string;
  eventType: string;
  title: string;
  detail: string | null;
  createdAt: string;
};

export type GrnDetailDto = {
  id: string;
  grnNumber: string;
  purchaseId: string;
  purchaseNumber: string;
  vendorName: string;
  vendorId: string;
  status: GRNStatus;
  lifecycle: GrnLifecycleStatus;
  workflowStep: number;
  warehouseName: string | null;
  warehouseId: string | null;
  receivedAt: string | null;
  qcPassed: boolean;
  stockUpdated: boolean;
  stockRotation: StockRotationPolicy;
  intakeValue: number;
  moisturePct: number | null;
  acidityPct: number | null;
  pulpYieldPct: number | null;
  seedRatioPct: number | null;
  foreignMatterPct: number | null;
  microbialPass: boolean | null;
  tamarindGrade: TamarindGrade | null;
  qcNotes: string | null;
  quarantineReason: string | null;
  supplierBatchRef: string | null;
  barcodeData: string | null;
  qrCodeData: string | null;
  mobileReceiptRef: string | null;
  fssaiCompliant: boolean;
  haccpCompliant: boolean;
  isoCompliant: boolean;
  qcOfficerName: string | null;
  gradeIntelligence: string;
  seasonalInsight: string;
  lineItems: GrnLineItemDto[];
  inspections: GrnInspectionDto[];
  timeline: GrnEventDto[];
  vendorReturns: { id: string; returnNumber: string; status: VendorReturnStatus; quantity: number; reason: string }[];
  complianceLogs: { id: string; standard: ComplianceStandard; passed: boolean; auditedAt: string }[];
  bins: { id: string; code: string; zone: string | null }[];
};

export type SupplierQcTrendPoint = {
  month: string;
  passRate: number;
  avgMoisture: number;
  rejectionRate: number;
};

export const EMPTY_GRN_KPIS: GrnExecutionKpis = {
  totalGrns: 0,
  pendingInspections: 0,
  rejectedBatches: 0,
  quarantineCount: 0,
  intakeValue: 0,
  avgVendorQuality: 0,
  pendingStockPost: 0,
  returnsOpen: 0,
};

export function lifecycleStepIndex(lifecycle: GrnLifecycleStatus): number {
  if (lifecycle === "STOCK_UPDATED" || lifecycle === "RETURNED_TO_VENDOR") return 4;
  if (lifecycle === "WAREHOUSE_ALLOCATED") return 3;
  if (["QC_INSPECTION", "QC_APPROVED", "QC_REJECTED", "QUARANTINE"].includes(lifecycle)) return 2;
  if (lifecycle === "GRN_CREATED") return 1;
  return 0;
}

export function gradeIntelligence(grade: TamarindGrade | null, moisture: number | null, seedRatio: number | null): string {
  if (grade === "PREMIUM" && moisture != null && moisture <= 10) return "Premium grade — suitable for export pulp & retail packs.";
  if (grade === "GRADE_A") return "Grade A — standard processing; target yield ≥38%.";
  if (grade === "GRADE_B") return "Grade B — blend with Grade A for consistent pulp output.";
  if (grade === "REJECT" || (moisture != null && moisture > 14)) return "Reject / high moisture — quarantine & re-dry or return to vendor.";
  if (seedRatio != null && seedRatio > 18) return "High seed ratio — de-seeding cost alert; negotiate vendor penalty.";
  return "Awaiting QC parameters for grade intelligence.";
}
