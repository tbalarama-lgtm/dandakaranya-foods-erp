"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";
import { LeadPriority, LeadSource, LeadStage } from "@prisma/client";
import { Button } from "@/components/ui/button";
import { CRM_SOURCE_LABELS, CRM_STAGE_LABELS, type CrmPipelineView } from "@/lib/crm-types";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { cn } from "@/lib/utils";

export function CrmFilters({
  assignees,
  showPipelineViews = false,
  initialPipeline = "all",
}: {
  assignees: { id: string; name: string }[];
  showPipelineViews?: boolean;
  initialPipeline?: CrmPipelineView;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const q = searchParams.get("q") ?? "";
  const stage = searchParams.get("stage") ?? "";
  const priority = searchParams.get("priority") ?? "";
  const source = searchParams.get("source") ?? "";
  const assignee = searchParams.get("assignee") ?? "";
  const pipeline = (searchParams.get("pipeline") ?? initialPipeline) as CrmPipelineView;
  const tab = searchParams.get("tab") ?? "";

  const apply = (updates: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/leads?${params.toString()}`);
  };

  return (
    <div className="erp-kpi-card flex flex-col gap-3 p-4">
      {showPipelineViews && (
        <div className="flex flex-wrap gap-2 border-b border-border/40 pb-3">
          {(["all", "export", "distributor"] as CrmPipelineView[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => apply({ pipeline: p === "all" ? "" : p })}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold capitalize transition",
                (pipeline === p || (p === "all" && !searchParams.get("pipeline")))
                  ? "bg-[#B68D40]/15 text-[#967235]"
                  : "bg-muted/50 text-muted-foreground hover:bg-muted",
              )}
            >
              {p === "all" ? "All pipeline" : p}
            </button>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" strokeWidth={ICON_STROKE} />
          <input
            type="search"
            placeholder="Search company, contact, MOQ, certifications…"
            defaultValue={q}
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                apply({ q: (e.target as HTMLInputElement).value, tab });
              }
            }}
          />
        </div>
        <FilterSelect
          label="Stage"
          value={stage}
          options={Object.values(LeadStage).map((s) => ({ value: s, label: CRM_STAGE_LABELS[s] }))}
          onChange={(v) => apply({ stage: v, tab })}
        />
        <FilterSelect
          label="Priority"
          value={priority}
          options={Object.values(LeadPriority).map((p) => ({ value: p, label: p }))}
          onChange={(v) => apply({ priority: v, tab })}
        />
        <FilterSelect
          label="Source"
          value={source}
          options={Object.values(LeadSource).map((s) => ({ value: s, label: CRM_SOURCE_LABELS[s] }))}
          onChange={(v) => apply({ source: v, tab })}
        />
        <FilterSelect
          label="Assignee"
          value={assignee}
          options={assignees.map((a) => ({ value: a.id, label: a.name }))}
          onChange={(v) => apply({ assignee: v, tab })}
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => router.push(tab ? `/leads?tab=${tab}` : "/leads")}
        >
          <SlidersHorizontal className="h-4 w-4" strokeWidth={ICON_STROKE} />
          Clear
        </Button>
      </div>
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
