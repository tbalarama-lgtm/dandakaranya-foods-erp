"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { CustomerCreditRisk, CustomerSegment, CustomerStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  CUSTOMER_RISK_LABELS,
  CUSTOMER_SEGMENT_LABELS,
  CUSTOMER_STATUS_LABELS,
} from "@/lib/customer-types";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export function CustomerFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const segment = searchParams.get("segment") ?? "";
  const status = searchParams.get("status") ?? "";
  const risk = searchParams.get("risk") ?? "";
  const sort = searchParams.get("sort") ?? "";
  const highValue = searchParams.get("highValue") === "1";

  const apply = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/customers?${params.toString()}`);
  };

  return (
    <div className="erp-kpi-card flex flex-col gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-end">
      <div className="relative min-w-[220px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={ICON_STROKE} />
        <input
          type="search"
          placeholder="Search name, company, GSTIN, territory…"
          defaultValue={q}
          className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") apply({ q: (e.target as HTMLInputElement).value });
          }}
        />
      </div>
      <FilterSelect
        label="Segment"
        value={segment}
        options={Object.values(CustomerSegment).map((s) => ({ value: s, label: CUSTOMER_SEGMENT_LABELS[s] }))}
        onChange={(v) => apply({ segment: v })}
      />
      <FilterSelect
        label="Status"
        value={status}
        options={Object.values(CustomerStatus).map((s) => ({ value: s, label: CUSTOMER_STATUS_LABELS[s] }))}
        onChange={(v) => apply({ status: v })}
      />
      <FilterSelect
        label="Credit risk"
        value={risk}
        options={Object.values(CustomerCreditRisk).map((r) => ({ value: r, label: CUSTOMER_RISK_LABELS[r] }))}
        onChange={(v) => apply({ risk: v })}
      />
      <FilterSelect
        label="Sort by"
        value={sort}
        options={[
          { value: "name", label: "Name" },
          { value: "ltv", label: "Lifetime value" },
          { value: "outstanding", label: "Outstanding" },
          { value: "recent", label: "Recent order" },
        ]}
        onChange={(v) => apply({ sort: v })}
      />
      <Button
        type="button"
        size="sm"
        variant={highValue ? "premium" : "secondary"}
        onClick={() => apply({ highValue: highValue ? "" : "1" })}
      >
        High value
      </Button>
      <Button type="button" size="sm" variant="secondary" onClick={() => router.push("/customers")}>
        <SlidersHorizontal className="h-4 w-4" strokeWidth={ICON_STROKE} />
        Clear
      </Button>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="min-w-[130px]">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 flex h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
      >
        <option value="">All</option>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
