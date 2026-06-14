import type { ProcurementApprovalType, VendorClassification } from "@prisma/client";
import type { ApprovalMatrixRuleDto } from "@/lib/approval-types";
import { ALL_APPROVAL_LEVELS, CORE_APPROVAL_LEVELS } from "@/lib/approval-types";

export type PurchaseMatrixInput = {
  total: number;
  classification: VendorClassification;
  department?: string | null;
  budgetAmount?: number | null;
  isSeasonal?: boolean;
  requiresQc?: boolean;
  supplierCertExpiring?: boolean;
  vendorQualityScore?: number | null;
};

const DEFAULT_RULES: ApprovalMatrixRuleDto[] = [
  {
    id: "default-standard",
    name: "Standard PO (< ₹5L)",
    minPoValue: null,
    maxPoValue: 500000,
    department: null,
    classification: null,
    requiredLevels: [...CORE_APPROVAL_LEVELS],
    escalateAbove: null,
    slaHours: 48,
    requiresQc: false,
    requiresCompliance: false,
    seasonalOnly: false,
  },
  {
    id: "high-value",
    name: "High-value PO (≥ ₹5L)",
    minPoValue: 500000,
    maxPoValue: 2000000,
    department: null,
    classification: null,
    requiredLevels: [...CORE_APPROVAL_LEVELS, "COMPLIANCE"],
    escalateAbove: 1000000,
    slaHours: 24,
    requiresQc: false,
    requiresCompliance: true,
    seasonalOnly: false,
  },
  {
    id: "enterprise-value",
    name: "Enterprise PO (≥ ₹20L)",
    minPoValue: 2000000,
    maxPoValue: null,
    department: null,
    classification: null,
    requiredLevels: [...ALL_APPROVAL_LEVELS],
    escalateAbove: 1000000,
    slaHours: 12,
    requiresQc: true,
    requiresCompliance: true,
    seasonalOnly: false,
  },
  {
    id: "raw-material-qc",
    name: "Raw material QC gate",
    minPoValue: 100000,
    maxPoValue: null,
    department: null,
    classification: "RAW_MATERIAL",
    requiredLevels: [...CORE_APPROVAL_LEVELS, "QUALITY_CONTROL"],
    escalateAbove: 500000,
    slaHours: 36,
    requiresQc: true,
    requiresCompliance: false,
    seasonalOnly: false,
  },
  {
    id: "fpo-seasonal",
    name: "FPO seasonal procurement",
    minPoValue: null,
    maxPoValue: null,
    department: null,
    classification: "FPO_PARTNER",
    requiredLevels: [...CORE_APPROVAL_LEVELS, "SEASONAL_PROCUREMENT"],
    escalateAbove: null,
    slaHours: 72,
    requiresQc: false,
    requiresCompliance: false,
    seasonalOnly: true,
  },
];

function parseLevels(raw: unknown): ProcurementApprovalType[] {
  if (!Array.isArray(raw)) return [...CORE_APPROVAL_LEVELS];
  return raw.filter((v): v is ProcurementApprovalType =>
    typeof v === "string" && ALL_APPROVAL_LEVELS.includes(v as ProcurementApprovalType),
  );
}

function ruleMatches(rule: ApprovalMatrixRuleDto, input: PurchaseMatrixInput): boolean {
  if (rule.minPoValue != null && input.total < rule.minPoValue) return false;
  if (rule.maxPoValue != null && input.total > rule.maxPoValue) return false;
  if (rule.department && rule.department !== (input.department ?? "")) return false;
  if (rule.classification && rule.classification !== input.classification) return false;
  if (rule.seasonalOnly && !input.isSeasonal) return false;
  return true;
}

export function resolveMatrixRule(
  input: PurchaseMatrixInput,
  dbRules: ApprovalMatrixRuleDto[] = [],
): ApprovalMatrixRuleDto {
  const rules = dbRules.length > 0 ? dbRules : DEFAULT_RULES;
  const matched = rules.filter((r) => ruleMatches(r, input));
  if (matched.length === 0) return DEFAULT_RULES[0];

  matched.sort((a, b) => {
    const score = (r: ApprovalMatrixRuleDto) =>
      (r.classification ? 4 : 0) +
      (r.department ? 2 : 0) +
      (r.minPoValue != null ? 1 : 0) +
      r.requiredLevels.length;
    return score(b) - score(a);
  });

  return matched[0];
}

export function resolveRequiredLevels(
  input: PurchaseMatrixInput,
  dbRules: ApprovalMatrixRuleDto[] = [],
): { levels: ProcurementApprovalType[]; rule: ApprovalMatrixRuleDto; slaHours: number } {
  const rule = resolveMatrixRule(input, dbRules);
  const levels = new Set<ProcurementApprovalType>(rule.requiredLevels);

  if (rule.requiresQc || input.requiresQc) levels.add("QUALITY_CONTROL");
  if (rule.requiresCompliance) levels.add("COMPLIANCE");
  if (input.isSeasonal) levels.add("SEASONAL_PROCUREMENT");
  if (input.supplierCertExpiring) levels.add("SUPPLIER_CERTIFICATION");
  if (input.vendorQualityScore != null && input.vendorQualityScore < 70) {
    levels.add("QUALITY_CONTROL");
  }

  const ordered = ALL_APPROVAL_LEVELS.filter((l) => levels.has(l));
  return { levels: ordered, rule, slaHours: rule.slaHours };
}

export function shouldAutoEscalate(total: number, rule: ApprovalMatrixRuleDto): boolean {
  return rule.escalateAbove != null && total >= rule.escalateAbove;
}

export function dbRuleToDto(row: {
  id: string;
  name: string;
  minPoValue: unknown;
  maxPoValue: unknown;
  department: string | null;
  classification: VendorClassification | null;
  requiredLevels: unknown;
  escalateAbove: unknown;
  slaHours: number;
  requiresQc: boolean;
  requiresCompliance: boolean;
  seasonalOnly: boolean;
}): ApprovalMatrixRuleDto {
  const num = (v: unknown) => (v == null ? null : Number(v));
  return {
    id: row.id,
    name: row.name,
    minPoValue: num(row.minPoValue),
    maxPoValue: num(row.maxPoValue),
    department: row.department,
    classification: row.classification,
    requiredLevels: parseLevels(row.requiredLevels),
    escalateAbove: num(row.escalateAbove),
    slaHours: row.slaHours,
    requiresQc: row.requiresQc,
    requiresCompliance: row.requiresCompliance,
    seasonalOnly: row.seasonalOnly,
  };
}

export { DEFAULT_RULES };
