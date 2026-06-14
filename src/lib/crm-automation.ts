import { LeadStage } from "@prisma/client";
import { prisma } from "@/lib/db";
import { upsertNotification } from "@/lib/notifications";
import { STALE_LEAD_DAYS } from "@/lib/crm-types";

/** CRM automation: stale lead alerts, overdue follow-ups, task reminders */
export async function syncCrmAutomation(): Promise<{ alerts: number }> {
  const now = new Date();
  const staleDate = new Date(Date.now() - STALE_LEAD_DAYS * 86400000);
  let alerts = 0;

  const staleLeads = await prisma.lead.findMany({
    where: {
      stage: { notIn: [LeadStage.WON, LeadStage.CONVERTED, LeadStage.LOST, LeadStage.DORMANT] },
      updatedAt: { lt: staleDate },
    },
    select: { id: true, company: true, assigneeId: true },
    take: 30,
  });

  for (const lead of staleLeads) {
    if (!lead.assigneeId) continue;
    await upsertNotification({
      userId: lead.assigneeId,
      title: "Stale lead alert",
      message: `${lead.company} has had no activity for ${STALE_LEAD_DAYS}+ days. Follow up now.`,
      category: "SALES",
      severity: "WARNING",
      link: `/leads/${lead.id}`,
      ruleKey: `stale-lead-${lead.id}`,
      actions: [
        { type: "VIEW_DETAILS", label: "Open lead", href: `/leads/${lead.id}` },
        { type: "RESOLVE", label: "Mark contacted" },
      ],
    });
    alerts++;
  }

  const overdueFollowUps = await prisma.lead.findMany({
    where: {
      followUpAt: { lt: now },
      stage: { notIn: [LeadStage.WON, LeadStage.CONVERTED, LeadStage.LOST] },
    },
    select: { id: true, company: true, contactName: true, assigneeId: true, followUpAt: true },
    take: 20,
  });

  for (const lead of overdueFollowUps) {
    if (!lead.assigneeId) continue;
    await upsertNotification({
      userId: lead.assigneeId,
      title: "Follow-up reminder",
      message: `Follow-up overdue for ${lead.company} (${lead.contactName}).`,
      category: "SALES",
      severity: "INFO",
      link: `/leads/${lead.id}`,
      ruleKey: `followup-${lead.id}-${lead.followUpAt?.toISOString().slice(0, 10)}`,
      actions: [{ type: "VIEW_DETAILS", label: "Follow up", href: `/leads/${lead.id}` }],
    });
    alerts++;
  }

  const dueTasks = await prisma.leadTask.findMany({
    where: { status: "PENDING", dueAt: { lte: now } },
    include: { lead: { select: { company: true, assigneeId: true } } },
    take: 20,
  });

  for (const task of dueTasks) {
    const userId = task.assigneeId ?? task.lead.assigneeId;
    if (!userId) continue;
    await upsertNotification({
      userId,
      title: "CRM task due",
      message: `"${task.title}" for ${task.lead.company} is due.`,
      category: "SALES",
      severity: "INFO",
      link: `/leads/${task.leadId}`,
      ruleKey: `task-due-${task.id}`,
    });
    alerts++;
  }

  return { alerts };
}
