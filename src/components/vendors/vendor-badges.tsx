import type { VendorClassification, VendorStatus } from "@prisma/client";
import { cn } from "@/lib/utils";
import {
  VENDOR_CLASSIFICATION_LABELS,
  VENDOR_CLASSIFICATION_STYLES,
  VENDOR_STATUS_LABELS,
  VENDOR_STATUS_STYLES,
} from "@/lib/vendor-types";

export function VendorClassificationBadge({ classification }: { classification: VendorClassification }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
        VENDOR_CLASSIFICATION_STYLES[classification],
      )}
    >
      {VENDOR_CLASSIFICATION_LABELS[classification]}
    </span>
  );
}

export function VendorStatusBadge({ status }: { status: VendorStatus }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold",
        VENDOR_STATUS_STYLES[status],
      )}
    >
      {VENDOR_STATUS_LABELS[status]}
    </span>
  );
}

export function FpoPartnerBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-emerald-500/12 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
      FPO Partner
    </span>
  );
}

export function PreferredVendorBadge() {
  return (
    <span className="inline-flex items-center rounded-md bg-[#B68D40]/15 px-2 py-0.5 text-[10px] font-semibold text-[#967235]">
      Preferred
    </span>
  );
}

export function ComplianceBadge({ score }: { score: number }) {
  const style =
    score >= 90
      ? "bg-emerald-500/12 text-emerald-700"
      : score >= 70
        ? "bg-amber-500/12 text-amber-700"
        : "bg-red-500/12 text-red-700";
  return (
    <span className={cn("inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-semibold", style)}>
      Compliance {score}%
    </span>
  );
}

export function QualityScoreBadge({ score }: { score: number | null }) {
  if (score == null) return null;
  const style =
    score >= 90 ? "text-emerald-700" : score >= 75 ? "text-amber-700" : "text-red-600";
  return <span className={cn("text-xs font-semibold", style)}>{score.toFixed(1)}%</span>;
}
