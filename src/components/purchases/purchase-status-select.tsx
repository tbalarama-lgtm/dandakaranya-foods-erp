"use client";

import { PaymentStatus } from "@prisma/client";
import { updatePurchaseStatus } from "@/actions/purchases";
import { toast } from "sonner";

export function PurchaseStatusSelect({ id, status }: { id: string; status: PaymentStatus }) {
  return (
    <select
      value={status}
      className="rounded-lg border border-border bg-background px-2 py-1 text-xs"
      onChange={async (e) => {
        const next = e.target.value as PaymentStatus;
        try {
          await updatePurchaseStatus(id, next);
          toast.success("Status updated");
        } catch {
          toast.error("Could not update status");
        }
      }}
    >
      {Object.values(PaymentStatus).map((s) => (
        <option key={s} value={s}>
          {s}
        </option>
      ))}
    </select>
  );
}
