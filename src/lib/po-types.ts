import type { PoLifecycleStatus, ShipmentStatus, TamarindGrade } from "@prisma/client";

export const PO_LIFECYCLE: PoLifecycleStatus[] = [
  "DRAFT",
  "SENT",
  "APPROVED",
  "PARTIALLY_RECEIVED",
  "FULLY_RECEIVED",
  "BILLED",
  "PAID",
  "CANCELLED",
];

export const PO_STATUS_LABELS: Record<PoLifecycleStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  APPROVED: "Approved",
  PARTIALLY_RECEIVED: "Partially received",
  FULLY_RECEIVED: "Fully received",
  BILLED: "Billed",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export const PO_STATUS_STYLES: Record<PoLifecycleStatus, string> = {
  DRAFT: "bg-slate-500/12 text-slate-600",
  SENT: "bg-sky-500/12 text-sky-700",
  APPROVED: "bg-indigo-500/12 text-indigo-700",
  PARTIALLY_RECEIVED: "bg-amber-500/12 text-amber-800",
  FULLY_RECEIVED: "bg-violet-500/12 text-violet-700",
  BILLED: "bg-orange-500/12 text-orange-700",
  PAID: "bg-emerald-500/12 text-emerald-700",
  CANCELLED: "bg-red-500/12 text-red-600",
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  PENDING: "Pending dispatch",
  DISPATCHED: "Dispatched",
  IN_TRANSIT: "In transit",
  DELAYED: "Delayed",
  DELIVERED: "Delivered",
};

export const EXECUTION_WORKFLOW = [
  { key: "RFQ", label: "RFQ" },
  { key: "PO", label: "PO" },
  { key: "GRN", label: "GRN" },
  { key: "QC", label: "QC" },
  { key: "STOCK", label: "Stock" },
  { key: "BILL", label: "Bill" },
  { key: "PAY", label: "Payment" },
] as const;

export type PoListRow = {
  id: string;
  purchaseNumber: string;
  vendorName: string;
  vendorId: string;
  poStatus: PoLifecycleStatus;
  shipmentStatus: ShipmentStatus;
  purchaseDate: string;
  expectedDelivery: string | null;
  total: number;
  itemCount: number;
  receivedPct: number;
  budgetAmount: number | null;
  budgetOverPct: number | null;
  isDelayed: boolean;
  rfqNumber: string | null;
  warehouseName: string | null;
};

export type PoLineItemDto = {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  gstAmount: number;
  freightAmount: number;
  lineTotal: number;
  tamarindGrade: TamarindGrade | null;
  moisturePct: number | null;
  acidityPct: number | null;
  seedRatioPct: number | null;
  expectedYieldPct: number | null;
  receivedQty: number;
  acceptedQty: number;
  batchNumber: string | null;
};

export type PoApprovalDto = {
  procurement: "PENDING" | "APPROVED" | "REJECTED";
  finance: "PENDING" | "APPROVED" | "REJECTED";
  inventory: "PENDING" | "APPROVED" | "REJECTED";
  budget: "PENDING" | "APPROVED" | "REJECTED";
};

export type PoTimelineEvent = {
  id: string;
  eventType: string;
  title: string;
  detail: string | null;
  createdAt: string;
};

export type PoDetailDto = {
  id: string;
  purchaseNumber: string;
  vendorName: string;
  vendorId: string;
  poStatus: PoLifecycleStatus;
  shipmentStatus: ShipmentStatus;
  transporter: string | null;
  purchaseDate: string;
  expectedDelivery: string | null;
  sentAt: string | null;
  dueDate: string | null;
  subtotal: number;
  gstAmount: number;
  freightAmount: number;
  total: number;
  budgetAmount: number | null;
  budgetWarning: string | null;
  paymentStatus: string;
  billUrl: string | null;
  notes: string | null;
  rfqId: string | null;
  rfqNumber: string | null;
  warehouseName: string | null;
  warehouseId: string | null;
  isDelayed: boolean;
  delayDays: number;
  receivedPct: number;
  yieldForecastPct: number | null;
  seasonalInsight: string;
  workflowStep: number;
  approvals: PoApprovalDto;
  lineItems: PoLineItemDto[];
  timeline: PoTimelineEvent[];
  grn: {
    id: string;
    grnNumber: string;
    status: string;
    qcPassed: boolean;
    moisturePct: number | null;
    tamarindGrade: TamarindGrade | null;
  } | null;
  vendorSla: { onTimePct: number; qualityScore: number; avgLeadDays: number };
};

export type PoExecutionKpis = {
  totalPos: number;
  openPos: number;
  delayedPos: number;
  pendingApproval: number;
  awaitingGrn: number;
  outstandingValue: number;
  paidThisMonth: number;
  avgLeadTimeDays: number;
  budgetAlerts: number;
};

export const EMPTY_PO_KPIS: PoExecutionKpis = {
  totalPos: 0,
  openPos: 0,
  delayedPos: 0,
  pendingApproval: 0,
  awaitingGrn: 0,
  outstandingValue: 0,
  paidThisMonth: 0,
  avgLeadTimeDays: 0,
  budgetAlerts: 0,
};

export const PO_SEASONAL_INSIGHT =
  "Monsoon procurement: allow +3–5 days lead time for Bastar tamarind routes. Target moisture ≤12%, seed ratio ≤18%, pulp yield ≥38% for pulp processing.";
