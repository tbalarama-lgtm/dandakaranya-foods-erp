import type { InvoiceStatus, PaymentStatus, QuotationTaxMode } from "@prisma/client";

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  VIEWED: "Viewed",
  PARTIALLY_PAID: "Partially Paid",
  PAID: "Paid",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
  REFUNDED: "Refunded",
};

export const INVOICE_STATUS_STYLES: Record<InvoiceStatus, string> = {
  DRAFT: "bg-slate-500/12 text-slate-600",
  SENT: "bg-blue-500/12 text-blue-700",
  VIEWED: "bg-indigo-500/12 text-indigo-700",
  PARTIALLY_PAID: "bg-amber-500/12 text-amber-700",
  PAID: "bg-emerald-500/12 text-emerald-700",
  OVERDUE: "bg-red-500/12 text-red-700",
  CANCELLED: "bg-gray-500/12 text-gray-600",
  REFUNDED: "bg-purple-500/12 text-purple-700",
};

export const INVOICE_TAX_MODE_LABELS: Record<QuotationTaxMode, string> = {
  DOMESTIC: "CGST + SGST",
  IGST: "IGST",
  EXPORT: "Export (zero-rated)",
};

export const INVOICE_TEMPLATES = [
  { key: "standard", name: "Standard tax invoice" },
  { key: "export", name: "Export commercial invoice" },
  { key: "institutional", name: "Institutional billing" },
];

export type InvoiceLineItem = {
  productId: string;
  productName: string;
  sku?: string;
  hsnCode?: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  discountAmount?: number;
  gstPercent: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineSubtotal: number;
  lineTotal: number;
  batchNumber?: string;
  expiryDate?: string;
  packagingNotes?: string;
  warehouseId?: string;
};

export type InvoiceListDto = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  customerId: string;
  salesperson: string;
  total: number;
  paidAmount: number;
  balance: number;
  currency: string;
  status: InvoiceStatus;
  paymentStatus: PaymentStatus;
  taxMode: QuotationTaxMode;
  invoiceDate: string;
  dueDate: string | null;
  isOverdue: boolean;
  itemCount: number;
  salesOrderNumber: string | null;
  warehouseName: string | null;
  eInvoiceIrn: string | null;
};

export type InvoiceAnalytics = {
  totalInvoices: number;
  totalRevenue: number;
  collected: number;
  outstanding: number;
  overdueCount: number;
  overdueAmount: number;
  collectionRate: number;
  avgDaysToPay: number;
  forecastReceivables: number;
  marginEstimate: number;
  byStatus: { status: InvoiceStatus; count: number; value: number }[];
  aging: { bucket: string; count: number; amount: number }[];
  hsnSummary: { hsn: string; taxableValue: number; gst: number }[];
};

export function syncLegacyPaymentStatus(status: InvoiceStatus): PaymentStatus {
  switch (status) {
    case "PARTIALLY_PAID":
      return "PARTIAL";
    case "PAID":
      return "PAID";
    case "OVERDUE":
      return "OVERDUE";
    case "CANCELLED":
    case "REFUNDED":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

export function deriveInvoiceStatus(
  total: number,
  paidAmount: number,
  dueDate: Date | null,
  current: InvoiceStatus,
): InvoiceStatus {
  if (current === "CANCELLED" || current === "REFUNDED" || current === "DRAFT") return current;
  const balance = total - paidAmount;
  if (balance <= 0.01) return "PAID";
  if (paidAmount > 0.01) {
    const overdue = dueDate && dueDate < new Date();
    return overdue ? "OVERDUE" : "PARTIALLY_PAID";
  }
  if (dueDate && dueDate < new Date() && !["DRAFT", "PAID", "CANCELLED", "REFUNDED"].includes(current)) {
    return "OVERDUE";
  }
  return current;
}

export function isInvoiceEditable(status: InvoiceStatus): boolean {
  return ["DRAFT", "SENT"].includes(status);
}
