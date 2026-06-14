import type { QuotationStatus, QuotationTaxMode } from "@prisma/client";

export const QUOTE_STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  UNDER_REVIEW: "Under Review",
  NEGOTIATION: "Negotiation",
  APPROVED: "Approved",
  ACCEPTED: "Approved",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  CONVERTED: "Converted",
};

export const QUOTE_STATUS_STYLES: Record<QuotationStatus, string> = {
  DRAFT: "bg-slate-500/12 text-slate-600",
  SENT: "bg-blue-500/12 text-blue-700",
  UNDER_REVIEW: "bg-indigo-500/12 text-indigo-700",
  NEGOTIATION: "bg-amber-500/12 text-amber-700",
  APPROVED: "bg-emerald-500/12 text-emerald-700",
  ACCEPTED: "bg-emerald-500/12 text-emerald-700",
  REJECTED: "bg-red-500/12 text-red-700",
  EXPIRED: "bg-gray-500/12 text-gray-600",
  CONVERTED: "bg-[#B68D40]/15 text-[#967235]",
};

export const QUOTE_TAX_MODE_LABELS: Record<QuotationTaxMode, string> = {
  DOMESTIC: "CGST + SGST",
  IGST: "IGST",
  EXPORT: "Export (zero-rated)",
};

export const QUOTE_TEMPLATES = [
  { key: "standard", name: "Standard commercial quote" },
  { key: "export", name: "Export proposal (FOB/CIF)" },
  { key: "institutional", name: "Institutional tender" },
];

export type QuotationLineItem = {
  productId: string;
  productName: string;
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
};

export type QuotationListDto = {
  id: string;
  quoteNumber: string;
  revisionNumber: number;
  customerName: string;
  customerId: string | null;
  leadId: string | null;
  salesperson: string;
  total: number;
  currency: string;
  status: QuotationStatus;
  validUntil: string | null;
  taxMode: QuotationTaxMode;
  incoterms: string | null;
  requiresApproval: boolean;
  isExpired: boolean;
  createdAt: string;
};

export type QuotationAnalytics = {
  totalQuotes: number;
  openQuotes: number;
  conversionRate: number;
  lostQuotes: number;
  avgNegotiationDays: number;
  forecastValue: number;
  byStatus: { status: QuotationStatus; count: number; value: number }[];
  expiringSoon: number;
};

export function normalizeQuoteStatus(status: QuotationStatus): QuotationStatus {
  return status === "ACCEPTED" ? "APPROVED" : status;
}

export function isQuoteOpen(status: QuotationStatus): boolean {
  return !["CONVERTED", "REJECTED", "EXPIRED"].includes(status);
}

export function isQuoteConvertible(status: QuotationStatus): boolean {
  return ["SENT", "UNDER_REVIEW", "NEGOTIATION", "APPROVED", "ACCEPTED"].includes(status);
}
