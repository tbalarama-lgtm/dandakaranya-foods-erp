"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { INVOICE_STATUS_LABELS } from "@/lib/invoice-types";
import type { InvoiceStatus } from "@prisma/client";

export function InvoiceFilters() {
  const router = useRouter();
  const sp = useSearchParams();

  return (
    <form
      className="erp-kpi-card flex flex-wrap items-end gap-3 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const params = new URLSearchParams();
        const q = String(fd.get("q") || "").trim();
        const status = String(fd.get("status") || "");
        if (q) params.set("q", q);
        if (status) params.set("status", status);
        if (fd.get("overdue") === "1") params.set("overdue", "1");
        router.push(`/sales?${params.toString()}`);
      }}
    >
      <div className="min-w-[200px] flex-1">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Search</label>
        <input
          name="q"
          defaultValue={sp.get("q") ?? ""}
          placeholder="Invoice #, customer, IRN…"
          className="mt-1 flex h-9 w-full rounded-lg border border-border px-3 text-sm"
        />
      </div>
      <div>
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
        <select name="status" defaultValue={sp.get("status") ?? ""} className="mt-1 flex h-9 rounded-lg border border-border px-2 text-sm">
          <option value="">All statuses</option>
          {(Object.keys(INVOICE_STATUS_LABELS) as InvoiceStatus[]).map((s) => (
            <option key={s} value={s}>
              {INVOICE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <label className="flex items-center gap-2 pb-1 text-sm">
        <input type="checkbox" name="overdue" value="1" defaultChecked={sp.get("overdue") === "1"} />
        Overdue only
      </label>
      <Button type="submit" size="sm" variant="premium">
        Apply
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => router.push("/sales")}>
        Clear
      </Button>
    </form>
  );
}
