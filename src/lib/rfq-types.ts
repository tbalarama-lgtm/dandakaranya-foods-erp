import type {
  RFQAuctionMode,
  RFQEventType,
  RFQSourcingType,
  RFQStatus,
  TamarindGrade,
  VendorClassification,
} from "@prisma/client";

export const RFQ_STATUS_LABELS: Record<RFQStatus, string> = {
  DRAFT: "Draft",
  SENT: "Sent",
  QUOTED: "Vendor responded",
  COMPARED: "Under comparison",
  APPROVED: "Approved",
  AWARDED: "Awarded",
  CLOSED: "Closed",
  CANCELLED: "Cancelled",
};

export const RFQ_STATUS_STYLES: Record<RFQStatus, string> = {
  DRAFT: "bg-slate-500/12 text-slate-600",
  SENT: "bg-sky-500/12 text-sky-700",
  QUOTED: "bg-violet-500/12 text-violet-700",
  COMPARED: "bg-indigo-500/12 text-indigo-700",
  APPROVED: "bg-emerald-500/12 text-emerald-700",
  AWARDED: "bg-[#B68D40]/15 text-[#967235]",
  CLOSED: "bg-muted text-muted-foreground",
  CANCELLED: "bg-red-500/12 text-red-600",
};

export const RFQ_LIFECYCLE: RFQStatus[] = [
  "DRAFT",
  "SENT",
  "QUOTED",
  "COMPARED",
  "APPROVED",
  "AWARDED",
  "CLOSED",
];

export const SOURCING_TYPE_LABELS: Record<RFQSourcingType, string> = {
  COMMERCIAL: "Commercial supplier",
  FPO: "FPO / cooperative",
  FARMER_DIRECT: "Farmer direct",
  MIXED: "Mixed sourcing",
};

export const AUCTION_MODE_LABELS: Record<RFQAuctionMode, string> = {
  STANDARD: "Standard RFQ",
  REVERSE_AUCTION: "Reverse auction",
};

export type RfqSourcingKpis = {
  totalRfqs: number;
  activeRfqs: number;
  avgResponseHours: number;
  avgNegotiationDays: number;
  conversionRatePct: number;
  procurementSavingsPct: number;
  awardedThisMonth: number;
  pendingComparison: number;
};

export type RfqListRow = {
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
  sourcingType: RFQSourcingType;
  auctionMode: RFQAuctionMode;
  budgetAmount: number | null;
  budgetOverPct: number | null;
  createdAt: string;
  sentAt: string | null;
};

export type RfqComparisonMatrixRow = {
  quoteId: string;
  vendorId: string;
  vendorName: string;
  vendorClassification: VendorClassification;
  isFpoPartner: boolean;
  unitPrice: number;
  totalPrice: number;
  deliveryDays: number | null;
  moq: number | null;
  moisturePct: number | null;
  pulpYieldPct: number | null;
  acidityPct: number | null;
  tamarindGrade: TamarindGrade | null;
  qualityScore: number;
  complianceScore: number;
  reliabilityScore: number;
  pricingHistoryScore: number;
  qcPassRate: number;
  compositeScore: number;
  rank: number;
  isSelected: boolean;
  isAiRecommended: boolean;
  recommendation: string;
  counterOfferPrice: number | null;
};

export type RfqTimelineEvent = {
  id: string;
  eventType: RFQEventType;
  title: string;
  detail: string | null;
  createdAt: string;
  vendorName: string | null;
};

export type RfqNegotiationRow = {
  id: string;
  round: number;
  offeredBy: string;
  vendorName: string;
  unitPrice: number;
  notes: string | null;
  createdAt: string;
};

export type RfqDetailDto = {
  id: string;
  rfqNumber: string;
  title: string;
  status: RFQStatus;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  dueDate: string | null;
  notes: string | null;
  budgetAmount: number | null;
  baselinePrice: number | null;
  budgetWarning: string | null;
  specTamarindGrade: TamarindGrade | null;
  specMoistureMaxPct: number | null;
  specPulpYieldMinPct: number | null;
  specAcidityMin: number | null;
  packagingRequirements: string | null;
  moqRequired: number | null;
  sourcingType: RFQSourcingType;
  auctionMode: RFQAuctionMode;
  auctionEndsAt: string | null;
  negotiationDeadline: string | null;
  seasonalWindow: string | null;
  seasonalInsight: string;
  awardedVendorId: string | null;
  awardedVendorName: string | null;
  aiRecommendedVendorId: string | null;
  aiRecommendedVendorName: string | null;
  aiRecommendationReason: string | null;
  purchaseId: string | null;
  purchaseNumber: string | null;
  sentAt: string | null;
  comparisonStartedAt: string | null;
  approvedAt: string | null;
  awardedAt: string | null;
  matrix: RfqComparisonMatrixRow[];
  timeline: RfqTimelineEvent[];
  negotiations: RfqNegotiationRow[];
  fpoComparison: { fpoAvgPrice: number | null; commercialAvgPrice: number | null; fpoSavingsPct: number | null };
};

export type RfqAnalytics = {
  savingsPct: number;
  avgResponseHours: number;
  avgNegotiationDays: number;
  conversionRatePct: number;
  responseTrend: { month: string; hours: number }[];
  statusDistribution: { status: string; count: number }[];
};

export const SEASONAL_INSIGHTS: Record<string, string> = {
  default:
    "Pre-monsoon tamarind window (Apr–Jun): prioritize Grade A with moisture ≤12%. FPO partners in Bastar often deliver 6–10% lower unit cost vs spot traders.",
  monsoon:
    "Monsoon logistics: allow +3–5 delivery days; tighten moisture specs and QC hold on inbound GRN.",
  harvest:
    "Peak harvest: run reverse auctions for bulk pulp; validate pulp yield ≥38% and acidity benchmarks.",
};
