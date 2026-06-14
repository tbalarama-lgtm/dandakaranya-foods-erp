import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { CrmLeadCard } from "@/components/leads/crm-lead-card";
import { CrmTimeline, CrmExportFields } from "@/components/leads/crm-timeline";
import { CrmQuotationsPanel } from "@/components/leads/crm-quotations-panel";
import { LeadDetailActions } from "@/components/leads/lead-detail-actions";
import { prisma } from "@/lib/db";
import { serializeCrmLead } from "@/lib/crm-metrics";
import { CRM_STAGE_LABELS, CRM_PRIORITY_LABELS, normalizeStage } from "@/lib/crm-types";
import { formatDate, formatInr } from "@/lib/utils";
import { requirePermission } from "@/lib/session";
import { CrmComments } from "@/components/leads/crm-comments";
import { CrmConversionChain } from "@/components/leads/crm-conversion-chain";
import { getCrmAssignees, getLeadConversionChain } from "@/lib/crm-queries";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission("leads.view");
  const { id } = await params;

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      assignee: { select: { id: true, name: true } },
      communications: { orderBy: { sentAt: "desc" }, include: { user: { select: { name: true } } } },
      tasks: { orderBy: { dueAt: "asc" } },
      quotations: { orderBy: { createdAt: "desc" } },
      samples: { orderBy: { createdAt: "desc" } },
      notes: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      _count: { select: { communications: true, tasks: true } },
    },
  });

  if (!lead) notFound();

  const dto = serializeCrmLead({
    ...lead,
    assignee: lead.assignee,
    _count: lead._count,
    tasks: lead.tasks.filter((t) => t.status === "PENDING"),
    communications: lead.communications.slice(0, 1).map((c) => ({
      channel: c.channel,
      sentAt: c.sentAt,
      message: c.message,
    })),
  });

  const [products, assignees, chain] = await Promise.all([
    prisma.product.findMany({
      where: { active: true },
      select: { id: true, name: true, salePrice: true },
      take: 50,
    }),
    getCrmAssignees(),
    getLeadConversionChain(id),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={lead.company}
        description={`${lead.contactName} · ${CRM_STAGE_LABELS[normalizeStage(lead.stage)]} · ${CRM_PRIORITY_LABELS[lead.priority]} priority`}
        action={{ label: "Back to CRM", href: "/leads" }}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <CrmLeadCard lead={dto} />

          <div className="erp-kpi-card p-5">
            <h3 className="text-sm font-semibold">Export & food industry profile</h3>
            <div className="mt-4">
              <CrmExportFields lead={lead} />
            </div>
            {lead.tastingFeedback && (
              <div className="mt-4 rounded-lg bg-[#B68D40]/10 p-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#967235]">Tasting feedback</p>
                <p className="mt-1 text-sm">{lead.tastingFeedback}</p>
              </div>
            )}
          </div>

          <div className="erp-kpi-card p-5">
            <h3 className="text-sm font-semibold">Communication timeline</h3>
            <div className="mt-4">
              <CrmTimeline items={lead.communications} />
            </div>
          </div>

          {lead.samples.length > 0 && (
            <div className="erp-kpi-card p-5">
              <h3 className="text-sm font-semibold">Sample management</h3>
              <ul className="mt-3 space-y-2">
                {lead.samples.map((s) => (
                  <li key={s.id} className="rounded-lg border border-border/50 px-3 py-2 text-sm">
                    <span className="font-medium">{s.productName}</span>
                    <span className="ml-2 text-xs text-muted-foreground">{s.status}</span>
                    {s.feedback && <p className="mt-1 text-xs text-muted-foreground">{s.feedback}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <CrmComments leadId={lead.id} notes={lead.notes} />
        </div>

        <div className="space-y-6 xl:sticky xl:top-4 xl:self-start">
          <CrmConversionChain chain={chain} />
          <LeadDetailActions
            leadId={lead.id}
            products={products}
            assignees={assignees}
            currentAssigneeId={lead.assigneeId}
            tasks={lead.tasks}
            tastingFeedback={lead.tastingFeedback ?? ""}
            leadPhone={lead.phone}
            leadEmail={lead.email ?? ""}
            contactName={lead.contactName}
          />

          <div className="erp-kpi-card p-5">
            <h3 className="text-sm font-semibold">Deal summary</h3>
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Est. value</dt>
                <dd className="font-semibold">{lead.value ? formatInr(Number(lead.value)) : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Follow-up</dt>
                <dd>{lead.followUpAt ? formatDate(lead.followUpAt) : "—"}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Last contact</dt>
                <dd>{lead.lastContactAt ? formatDate(lead.lastContactAt) : "—"}</dd>
              </div>
            </dl>
          </div>

          <div className="erp-kpi-card p-5">
            <h3 className="text-sm font-semibold">Tasks</h3>
            <ul className="mt-3 space-y-2">
              {lead.tasks.length === 0 ? (
                <li className="text-xs text-muted-foreground">No tasks</li>
              ) : (
                lead.tasks.map((t) => (
                  <li key={t.id} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-xs">
                    <span>{t.title}</span>
                    <span className={t.status === "COMPLETED" ? "text-emerald-600" : "text-amber-600"}>
                      {t.status}
                      {t.dueAt && t.status === "PENDING" ? ` · ${formatDate(t.dueAt)}` : ""}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </div>

          <CrmQuotationsPanel quotations={lead.quotations} />
        </div>
      </div>
    </div>
  );
}
