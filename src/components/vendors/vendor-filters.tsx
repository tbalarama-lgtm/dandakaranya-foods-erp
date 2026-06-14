"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { VendorClassification, VendorStatus } from "@prisma/client";
import { Button } from "@/components/ui/button";
import {
  VENDOR_CLASSIFICATION_LABELS,
  VENDOR_STATUS_LABELS,
} from "@/lib/vendor-types";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export function VendorFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const classification = searchParams.get("classification") ?? "";
  const status = searchParams.get("status") ?? "";
  const sort = searchParams.get("sort") ?? "";
  const fpoOnly = searchParams.get("fpoOnly") === "1";

  const apply = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/vendors?${params.toString()}`);
  };

  return (
    <div className="erp-kpi-card flex flex-col gap-3 p-4 lg:flex-row lg:flex-wrap lg:items-end">
      <div className="relative min-w-[220px] flex-1">
        <Search
          className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
          strokeWidth={ICON_STROKE}
        />
        <input
          type="search"
          placeholder="Search name, code, GSTIN, FPO region…"
          defaultValue={q}
          className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm"
          onKeyDown={(e) => {
            if (e.key === "Enter") apply({ q: (e.target as HTMLInputElement).value });
          }}
        />
      </div>
      <FilterSelect
        label="Classification"
        value={classification}
        options={Object.values(VendorClassification).map((c) => ({
          value: c,
          label: VENDOR_CLASSIFICATION_LABELS[c],
        }))}
        onChange={(v) => apply({ classification: v })}
      />
      <FilterSelect
        label="Status"
        value={status}
        options={Object.values(VendorStatus).map((s) => ({
          value: s,
          label: VENDOR_STATUS_LABELS[s],
        }))}
        onChange={(v) => apply({ status: v })}
      />
      <FilterSelect
        label="Sort by"
        value={sort}
        options={[
          { value: "name", label: "Name" },
          { value: "spend", label: "Procurement spend" },
          { value: "outstanding", label: "Outstanding payables" },
          { value: "quality", label: "Quality score" },
          { value: "recent", label: "Recent purchase" },
        ]}
        onChange={(v) => apply({ sort: v })}
      />
      <Button
        type="button"
        size="sm"
        variant={fpoOnly ? "premium" : "secondary"}
        onClick={() => apply({ fpoOnly: fpoOnly ? "" : "1" })}
      >
        <SlidersHorizontal className="mr-1.5 h-4 w-4" strokeWidth={ICON_STROKE} />
        FPO partners
      </Button>
      {(q || classification || status || sort || fpoOnly) && (
        <Button type="button" size="sm" variant="ghost" onClick={() => router.push("/vendors")}>
          Clear filters
        </Button>
      )}
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
    <div className="min-w-[140px]">
      <label className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
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
