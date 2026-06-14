"use client";

import { useRouter } from "next/navigation";
import type { InvoiceStatus } from "@prisma/client";
import { updateInvoiceStatus } from "@/actions/sales";
import { INVOICE_STATUS_LABELS } from "@/lib/invoice-types";
import { toast } from "sonner";

export function InvoiceStatusSelect({ id, status }: { id: string; status: InvoiceStatus }) {
  const router = useRouter();

  return (
    <select
      value={status}
      className="h-8 rounded-md border border-border bg-background px-2 text-xs"
      onChange={async (e) => {
        try {
          await updateInvoiceStatus(id, e.target.value as InvoiceStatus);
          toast.success("Status updated");
          router.refresh();
        } catch {
          toast.error("Update failed");
        }
      }}
    >
      {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => (
        <option key={s} value={s}>
          {INVOICE_STATUS_LABELS[s]}
        </option>
      ))}
    </select>
  );
}
