"use client";

import type { InvoiceStatus } from "@prisma/client";
import { INVOICE_STATUS_LABELS, INVOICE_STATUS_STYLES } from "@/lib/invoice-types";
import { cn } from "@/lib/utils";

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  return (
    <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold uppercase", INVOICE_STATUS_STYLES[status])}>
      {INVOICE_STATUS_LABELS[status]}
    </span>
  );
}
