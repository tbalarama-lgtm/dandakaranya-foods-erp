"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { QuotationStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { QUOTE_STATUS_LABELS } from "@/lib/quotation-types";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export function QuotationFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const status = searchParams.get("status") ?? "";
  const expiring = searchParams.get("expiring") === "1";

  const apply = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/quotations?${params.toString()}`);
  };

  return (
    <div className="erp-kpi-card flex flex-col gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-end">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={ICON_STROKE} />
        <input
          type="search"
          placeholder="Search quote #, customer, notes…"
          defaultValue={q}
          className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") apply({ q: (e.target as HTMLInputElement).value });
          }}
        />
      </div>
      <div className="min-w-[140px]">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</label>
        <select
          value={status}
          onChange={(e) => apply({ status: e.target.value })}
          className="mt-1 flex h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
        >
          <option value="">All</option>
          {Object.values(QuotationStatus).map((s) => (
            <option key={s} value={s}>
              {QUOTE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
      </div>
      <Button
        type="button"
        size="sm"
        variant={expiring ? "premium" : "secondary"}
        onClick={() => apply({ expiring: expiring ? "" : "1" })}
      >
        Expiring soon
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => router.push("/quotations")}>
        <SlidersHorizontal className="h-4 w-4" strokeWidth={ICON_STROKE} />
        Clear
      </Button>
    </div>
  );
}
