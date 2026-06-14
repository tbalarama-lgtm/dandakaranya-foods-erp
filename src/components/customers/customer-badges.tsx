"use client";

import { cn } from "@/lib/utils";
import type { CustomerCreditRisk, CustomerStatus } from "@prisma/client";
import {
  CUSTOMER_RISK_LABELS,
  CUSTOMER_RISK_STYLES,
  CUSTOMER_SEGMENT_LABELS,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_STATUS_STYLES,
} from "@/lib/customer-types";
import type { CustomerSegment } from "@prisma/client";

export function CustomerStatusBadge({ status }: { status: CustomerStatus }) {
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider", CUSTOMER_STATUS_STYLES[status])}>
      {CUSTOMER_STATUS_LABELS[status]}
    </span>
  );
}

export function CustomerSegmentBadge({ segment }: { segment: CustomerSegment }) {
  return (
    <span className="rounded-md bg-[#1E3A5F]/10 px-2 py-0.5 text-[10px] font-semibold text-[#1E3A5F]">
      {CUSTOMER_SEGMENT_LABELS[segment]}
    </span>
  );
}

export function CustomerRiskBadge({ risk }: { risk: CustomerCreditRisk }) {
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", CUSTOMER_RISK_STYLES[risk])}>
      {CUSTOMER_RISK_LABELS[risk]}
    </span>
  );
}

export function HighValueBadge() {
  return (
    <span className="rounded-md bg-[#B68D40]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#967235]">
      High Value
    </span>
  );
}
