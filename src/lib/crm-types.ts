import type { LeadPriority, LeadSource, LeadStage } from "@prisma/client";

/** Active pipeline stages in lifecycle order (excludes terminal states from kanban cols optionally) */
export const CRM_PIPELINE_STAGES: LeadStage[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "SAMPLE_SENT",
  "WON",
  "LOST",
  "DORMANT",
];

export const CRM_KANBAN_STAGES: LeadStage[] = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "SAMPLE_SENT",
];

export const CRM_TERMINAL_STAGES: LeadStage[] = ["WON", "LOST", "DORMANT"];

export const CRM_STAGE_LABELS: Record<LeadStage, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  QUALIFIED: "Qualified",
  PROPOSAL_SENT: "Proposal Sent",
  NEGOTIATION: "Negotiation",
  SAMPLE_SENT: "Sample Sent",
  WON: "Won",
  CONVERTED: "Won",
  LOST: "Lost",
  DORMANT: "Dormant",
};

export const CRM_STAGE_COLORS: Record<LeadStage, string> = {
  NEW: "#6366F1",
  CONTACTED: "#3B82F6",
  QUALIFIED: "#0EA5E9",
  PROPOSAL_SENT: "#8B5CF6",
  NEGOTIATION: "#F59E0B",
  SAMPLE_SENT: "#EC4899",
  WON: "#10B981",
  CONVERTED: "#10B981",
  LOST: "#EF4444",
  DORMANT: "#64748B",
};

export const CRM_PRIORITY_LABELS: Record<LeadPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const CRM_PRIORITY_STYLES: Record<LeadPriority, string> = {
  LOW: "bg-slate-500/12 text-slate-600 dark:text-slate-400",
  MEDIUM: "bg-blue-500/12 text-blue-600 dark:text-blue-400",
  HIGH: "bg-amber-500/12 text-amber-600 dark:text-amber-400",
  URGENT: "bg-red-500/12 text-red-600 dark:text-red-400",
};

export const CRM_SOURCE_LABELS: Record<LeadSource, string> = {
  WEBSITE: "Website",
  WHATSAPP: "WhatsApp",
  REFERRAL: "Referral",
  TRADE_FAIR: "Trade Fair",
  LINKEDIN: "LinkedIn",
  DISTRIBUTOR: "Distributor",
  OTHER: "Other",
};

export function normalizeStage(stage: LeadStage): LeadStage {
  return stage === "CONVERTED" ? "WON" : stage;
}

export function isWonStage(stage: LeadStage): boolean {
  return stage === "WON" || stage === "CONVERTED";
}

export type CrmLeadDto = {
  id: string;
  company: string;
  contactName: string;
  email: string | null;
  phone: string;
  stage: LeadStage;
  priority: LeadPriority;
  leadSource: LeadSource | null;
  products: string | null;
  volume: string | null;
  value: number | null;
  country: string | null;
  moq: string | null;
  packagingPreference: string | null;
  shippingTerms: string | null;
  certifications: string | null;
  distributorName: string | null;
  productCategories: string | null;
  tastingFeedback: string | null;
  followUpAt: string | null;
  lastContactAt: string | null;
  createdAt: string;
  updatedAt: string;
  assignee: { id: string; name: string } | null;
  commCount: number;
  taskCount: number;
  pendingTasks: number;
  isStale: boolean;
  probability: number;
  weightedValue: number;
  ageDays: number;
  lastActivity: CrmLastActivity;
};

export const EMAIL_TEMPLATES = [
  {
    id: "intro",
    name: "Product introduction",
    subject: "Dandakaranya Foods — Premium spice & food ingredients",
    body: "Dear {{contact}},\n\nThank you for your interest in Dandakaranya Foods. We specialize in premium tamarind, spice powders, and food manufacturing ingredients with FSSAI certification.\n\nI'd love to share our catalog and discuss your requirements.\n\nBest regards,\n{{assignee}}",
  },
  {
    id: "followup",
    name: "Follow-up reminder",
    subject: "Following up on your enquiry",
    body: "Hi {{contact}},\n\nI wanted to follow up on our previous conversation regarding {{products}}. Please let me know if you need samples, pricing, or MOQ details.\n\nRegards,\n{{assignee}}",
  },
  {
    id: "quotation",
    name: "Quotation sent",
    subject: "Quotation — Dandakaranya Foods",
    body: "Dear {{contact}},\n\nPlease find attached our quotation for {{products}}. Validity: 30 days. MOQ and shipping terms as discussed.\n\nHappy to schedule a call.\n\n{{assignee}}",
  },
];

export function applyEmailTemplate(
  template: string,
  vars: { contact: string; assignee: string; products: string },
) {
  return template
    .replace(/\{\{contact\}\}/g, vars.contact)
    .replace(/\{\{assignee\}\}/g, vars.assignee)
    .replace(/\{\{products\}\}/g, vars.products);
}

export const STALE_LEAD_DAYS = 14;

/** Win probability by stage (0–1) for weighted revenue forecasting */
export const STAGE_PROBABILITY: Record<LeadStage, number> = {
  NEW: 0.05,
  CONTACTED: 0.15,
  QUALIFIED: 0.3,
  PROPOSAL_SENT: 0.45,
  NEGOTIATION: 0.6,
  SAMPLE_SENT: 0.75,
  WON: 1,
  CONVERTED: 1,
  LOST: 0,
  DORMANT: 0.02,
};

export function getStageProbability(stage: LeadStage): number {
  return STAGE_PROBABILITY[normalizeStage(stage)] ?? 0.1;
}

export function getWeightedValue(value: number | null, stage: LeadStage): number {
  if (value == null || value <= 0) return 0;
  return Math.round(value * getStageProbability(stage));
}

export type CrmPipelineView = "all" | "export" | "distributor";

export type CrmLastActivity = {
  channel: string;
  at: string;
  preview: string;
} | null;
