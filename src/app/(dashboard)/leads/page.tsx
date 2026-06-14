import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CrmPlatform } from "@/components/leads/crm-platform";
import { getCrmAnalytics } from "@/lib/crm-metrics";
import { getCrmAssignees, getCrmLeads } from "@/lib/crm-queries";
import { syncCrmAutomation } from "@/lib/crm-automation";
import { requirePermission } from "@/lib/session";
import type { LeadPriority, LeadSource, LeadStage } from "@prisma/client";
import type { CrmPipelineView } from "@/lib/crm-types";

export const dynamic = "force-dynamic";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    stage?: string;
    priority?: string;
    source?: string;
    assignee?: string;
    tab?: string;
    pipeline?: string;
  }>;
}) {
  await requirePermission("leads.view");
  const sp = await searchParams;

  // Fire-and-forget CRM automation sync (stale alerts, follow-ups, task reminders)
  void syncCrmAutomation().catch(() => {});

  const pipelineView = (sp.pipeline as CrmPipelineView | undefined) ?? "all";

  const [leads, analytics, assignees] = await Promise.all([
    getCrmLeads({
      q: sp.q,
      stage: sp.stage as LeadStage | undefined,
      priority: sp.priority as LeadPriority | undefined,
      source: sp.source as LeadSource | undefined,
      assignee: sp.assignee,
      pipeline: pipelineView,
    }),
    getCrmAnalytics(),
    getCrmAssignees(),
  ]);

  const initialTab =
    sp.tab === "analytics" ? "analytics" : sp.tab === "list" ? "list" : "pipeline";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales CRM"
        description="Enterprise pipeline · export enquiries · food industry lead management"
        action={{ label: "Add lead", href: "/leads/new" }}
      />
      <Suspense fallback={null}>
        <CrmPlatform
          leads={leads}
          analytics={analytics}
          assignees={assignees}
          initialTab={initialTab}
          initialPipeline={pipelineView}
        />
      </Suspense>
    </div>
  );
}
