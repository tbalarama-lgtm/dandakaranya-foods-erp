"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { BarChart3, Columns3, List, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CrmKanban } from "@/components/leads/crm-kanban";
import { CrmLeadCard } from "@/components/leads/crm-lead-card";
import { CrmFilters } from "@/components/leads/crm-filters";
import { CrmAnalyticsPanel } from "@/components/leads/crm-analytics";
import { CrmPipelineHeader } from "@/components/leads/crm-pipeline-header";
import type { CrmLeadDto, CrmPipelineView } from "@/lib/crm-types";
import type { CrmAnalytics } from "@/lib/crm-metrics";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { cn } from "@/lib/utils";

type Tab = "pipeline" | "list" | "analytics";

export function CrmPlatform({
  leads,
  analytics,
  assignees,
  initialTab = "pipeline",
  initialPipeline = "all",
}: {
  leads: CrmLeadDto[];
  analytics: CrmAnalytics;
  assignees: { id: string; name: string }[];
  initialTab?: Tab;
  initialPipeline?: CrmPipelineView;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "pipeline", label: "Pipeline", icon: Columns3 },
    { id: "list", label: "List", icon: List },
    { id: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-1 rounded-xl bg-muted/50 p-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition sm:px-4",
                tab === t.id
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <t.icon className="h-4 w-4" strokeWidth={ICON_STROKE} />
              <span className="hidden xs:inline">{t.label}</span>
            </button>
          ))}
        </div>
        <Button variant="premium" asChild className="w-full sm:w-auto">
          <Link href="/leads/new">
            <Plus className="h-4 w-4" strokeWidth={ICON_STROKE} />
            Add lead
          </Link>
        </Button>
      </div>

      <Suspense fallback={null}>
        <CrmFilters assignees={assignees} showPipelineViews={tab === "pipeline" || tab === "list"} initialPipeline={initialPipeline} />
      </Suspense>

      {tab === "pipeline" && (
        <div className="space-y-4">
          <CrmPipelineHeader analytics={analytics} />
          <CrmKanban initialLeads={leads} />
        </div>
      )}
      {tab === "list" && (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {leads.length === 0 ? (
            <p className="col-span-full py-12 text-center text-muted-foreground">No leads match your filters.</p>
          ) : (
            leads.map((lead) => <CrmLeadCard key={lead.id} lead={lead} />)
          )}
        </div>
      )}
      {tab === "analytics" && <CrmAnalyticsPanel analytics={analytics} leads={leads} />}
    </div>
  );
}
