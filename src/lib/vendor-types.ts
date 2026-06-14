import type {
  GRNStatus,
  ProcurementStage,
  RFQStatus,
  TamarindGrade,
  VendorClassification,
  VendorContractStatus,
  VendorDocType,
  VendorPaymentTerms,
  VendorStatus,
} from "@prisma/client";

export const PREFERRED_VENDOR_THRESHOLD = 1_000_000;

export const VENDOR_CLASSIFICATION_LABELS: Record<VendorClassification, string> = {
  RAW_MATERIAL: "Raw material supplier",
  PACKAGING: "Packaging vendor",
  LOGISTICS: "Logistics vendor",
  FPO_PARTNER: "FPO partner",
  EQUIPMENT: "Equipment supplier",
};

export const VENDOR_CLASSIFICATION_STYLES: Record<VendorClassification, string> = {
  RAW_MATERIAL: "bg-amber-500/12 text-amber-800",
  PACKAGING: "bg-sky-500/12 text-sky-700",
  LOGISTICS: "bg-violet-500/12 text-violet-700",
  FPO_PARTNER: "bg-emerald-500/12 text-emerald-700",
  EQUIPMENT: "bg-slate-500/12 text-slate-700",
};

export const VENDOR_STATUS_LABELS: Record<VendorStatus, string> = {
  ACTIVE: "Active",
  PREFERRED: "Preferred",
  PENDING_APPROVAL: "Pending approval",
  BLACKLISTED: "Blacklisted",
  INACTIVE: "Inactive",
};

export const VENDOR_STATUS_STYLES: Record<VendorStatus, string> = {
  ACTIVE: "bg-emerald-500/12 text-emerald-700",
  PREFERRED: "bg-[#B68D40]/15 text-[#967235]",
  PENDING_APPROVAL: "bg-amber-500/12 text-amber-700",
  BLACKLISTED: "bg-red-500/12 text-red-700",
  INACTIVE: "bg-slate-500/12 text-slate-600",
};

export const VENDOR_PAYMENT_TERMS_LABELS: Record<VendorPaymentTerms, string> = {
  NET_7: "Net 7 days",
  NET_15: "Net 15 days",
  NET_30: "Net 30 days",
  NET_45: "Net 45 days",
  NET_60: "Net 60 days",
  ADVANCE: "Advance payment",
  COD: "Cash on delivery",
  CUSTOM: "Custom terms",
};

export const VENDOR_DOC_LABELS: Record<VendorDocType, string> = {
  GST_CERTIFICATE: "GST certificate",
  AGREEMENT: "Agreement",
  FSSAI_LICENSE: "FSSAI license",
  COMPLIANCE: "Compliance document",
  BANK_DETAILS: "Bank details",
  OTHER: "Other",
};

export const PROCUREMENT_STAGE_LABELS: Record<ProcurementStage, string> = {
  DRAFT: "Draft",
  RFQ: "RFQ",
  PO_ISSUED: "Purchase order",
  GRN_RECEIVED: "GRN received",
  QUALITY_CHECK: "Quality check",
  BILLED: "Bill recorded",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const PROCUREMENT_STAGE_STYLES: Record<ProcurementStage, string> = {
  DRAFT: "bg-slate-500/12 text-slate-600",
  RFQ: "bg-violet-500/12 text-violet-700",
  PO_ISSUED: "bg-sky-500/12 text-sky-700",
  GRN_RECEIVED: "bg-indigo-500/12 text-indigo-700",
  QUALITY_CHECK: "bg-amber-500/12 text-amber-800",
  BILLED: "bg-orange-500/12 text-orange-700",
  PAID: "bg-emerald-500/12 text-emerald-700",
  CANCELLED: "bg-red-500/12 text-red-600",
};

export const GRN_STATUS_LABELS: Record<GRNStatus, string> = {
  PENDING: "Pending",
  PARTIAL: "Partial receipt",
  RECEIVED: "Received",
  REJECTED: "Rejected",
  QC_HOLD: "QC hold",
};

export { RFQ_STATUS_LABELS } from "@/lib/rfq-types";

export const CONTRACT_STATUS_LABELS: Record<VendorContractStatus, string> = {
  ACTIVE: "Active",
  EXPIRING: "Expiring soon",
  EXPIRED: "Expired",
  TERMINATED: "Terminated",
  DRAFT: "Draft",
};

export const TAMARIND_GRADE_LABELS: Record<TamarindGrade, string> = {
  PREMIUM: "Premium",
  GRADE_A: "Grade A",
  GRADE_B: "Grade B",
  REJECT: "Reject",
};

export type VendorListDto = {
  id: string;
  code: string | null;
  name: string;
  classification: VendorClassification;
  status: VendorStatus;
  contact: string | null;
  email: string | null;
  phone: string | null;
  gstin: string | null;
  city: string | null;
  state: string | null;
  paymentTerms: VendorPaymentTerms;
  qualityScore: number | null;
  deliveryScore: number | null;
  rejectionRate: number | null;
  isFpoPartner: boolean;
  purchaseCount: number;
  totalSpend: number;
  outstandingPayable: number;
  overdueCount: number;
  advancePaid: number;
  lastPurchaseAt: string | null;
  contractRenewalAt: string | null;
  isPreferredSpend: boolean;
  complianceScore: number;
  expiringDocs: number;
};

export type VendorDetailDto = VendorListDto & {
  address: string | null;
  pincode: string | null;
  notes: string | null;
  bankName: string | null;
  bankAccount: string | null;
  bankIfsc: string | null;
  fssaiNumber: string | null;
  fpoRegion: string | null;
  seasonalNotes: string | null;
  moistureLimitPct: number | null;
  preferredWarehouseId: string | null;
  preferredWarehouseName: string | null;
  createdAt: string;
  contacts: {
    id: string;
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    isPrimary: boolean;
  }[];
};

export type VendorAnalytics = {
  totalVendors: number;
  activeVendors: number;
  preferredVendors: number;
  pendingApproval: number;
  blacklisted: number;
  totalSpend: number;
  outstandingPayables: number;
  overduePayables: number;
  avgQualityScore: number;
  avgDeliveryScore: number;
  avgRejectionRate: number;
  spendTrend: { month: string; spend: number }[];
  byClassification: { classification: VendorClassification; count: number; spend: number }[];
  topVendors: { id: string; name: string; spend: number }[];
  complianceAlerts: number;
  expiringContracts: number;
  openRfqs: number;
  pendingGrns: number;
};

export type VendorSpendPoint = { month: string; spend: number; orders: number };

export type VendorQualityTrend = {
  month: string;
  qualityScore: number;
  rejectionRate: number;
  moistureAvg: number | null;
};

export type ProcurementKpis = {
  totalPos: number;
  pendingApprovals: number;
  pendingGrns: number;
  outstandingBills: number;
  paidThisMonth: number;
  spendThisMonth: number;
  avgPoCycleDays: number;
  onTimeDeliveryPct: number;
};

export type RFQListDto = {
  id: string;
  rfqNumber: string;
  title: string;
  status: RFQStatus;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  dueDate: string | null;
  quoteCount: number;
  lowestQuote: number | null;
  awardedVendorName: string | null;
  createdAt: string;
};

export type WorkflowStep = {
  stage: ProcurementStage;
  label: string;
  count: number;
  value: number;
};
