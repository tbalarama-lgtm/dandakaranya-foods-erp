import { LeadStage } from "@prisma/client";
import type { CommunicationChannel } from "@prisma/client";
import { prisma } from "@/lib/db";
import {
  CRM_KANBAN_STAGES,
  getStageProbability,
  getWeightedValue,
  isWonStage,
  normalizeStage,
  STALE_LEAD_DAYS,
  type CrmLastActivity,
} from "@/lib/crm-types";
import { toNumber } from "@/lib/utils";

export type StageConversion = {
  from: LeadStage;
  to: LeadStage;
  fromCount: number;
  toCount: number;
  rate: number;
  dropOff: number;
};

export type AgingBucket = {
  label: string;
  count: number;
  value: number;
};

export type CrmAnalytics = {
  totalLeads: number;
  pipelineValue: number;
  wonValue: number;
  forecastValue: number;
  weightedForecast: number;
  conversionRate: number;
  avgSalesCycleDays: number;
  byStage: { stage: LeadStage; count: number; value: number; weighted: number }[];
  bySource: { source: string; count: number }[];
  byAssignee: { name: string; count: number; value: number; weighted: number }[];
  staleCount: number;
  overdueFollowUps: number;
  stageConversions: StageConversion[];
  funnelStages: { stage: string; count: number; rate: number }[];
  agingLeads: AgingBucket[];
  exportPipeline: { count: number; value: number; weighted: number };
  distributorPipeline: { count: number; value: number; weighted: number };
  samplePipeline: { count: number; inSampleStage: number };
};

export async function getCrmAnalytics(): Promise<CrmAnalytics> {
  const staleDate = new Date(Date.now() - STALE_LEAD_DAYS * 86400000);
  const now = new Date();

  const [leads, overdueFollowUps] = await Promise.all([
    prisma.lead.findMany({
      select: {
        stage: true,
        value: true,
        leadSource: true,
        updatedAt: true,
        createdAt: true,
        convertedAt: true,
        followUpAt: true,
        country: true,
        distributorName: true,
        sampleStatus: true,
        assignee: { select: { name: true } },
      },
    }),
    prisma.lead.count({
      where: { followUpAt: { lt: now }, stage: { notIn: ["WON", "CONVERTED", "LOST"] } },
    }),
  ]);

  const totalLeads = leads.length;
  const won = leads.filter((l) => isWonStage(l.stage));
  const open = leads.filter((l) => !isWonStage(l.stage) && l.stage !== "LOST" && l.stage !== "DORMANT");

  const pipelineValue = open.reduce((s, l) => s + toNumber(l.value), 0);
  const wonValue = won.reduce((s, l) => s + toNumber(l.value), 0);
  let weightedForecast = 0;
  const forecastValue = open.reduce((s, l) => {
    const v = toNumber(l.value);
    const w = getStageProbability(l.stage);
    weightedForecast += v * w;
    return s + v;
  }, 0);

  const stageMap = new Map<LeadStage, { count: number; value: number; weighted: number }>();
  for (const l of leads) {
    const stage = normalizeStage(l.stage);
    const cur = stageMap.get(stage) ?? { count: 0, value: 0, weighted: 0 };
    const val = toNumber(l.value);
    cur.count += 1;
    cur.value += val;
    cur.weighted += getWeightedValue(val, l.stage);
    stageMap.set(stage, cur);
  }

  const sourceMap = new Map<string, number>();
  for (const l of leads) {
    const src = l.leadSource ?? "OTHER";
    sourceMap.set(src, (sourceMap.get(src) ?? 0) + 1);
  }

  const assigneeMap = new Map<string, { count: number; value: number; weighted: number }>();
  for (const l of leads) {
    const name = l.assignee?.name ?? "Unassigned";
    const cur = assigneeMap.get(name) ?? { count: 0, value: 0, weighted: 0 };
    const val = toNumber(l.value);
    cur.count += 1;
    cur.value += val;
    cur.weighted += getWeightedValue(val, l.stage);
    assigneeMap.set(name, cur);
  }

  const staleCount = leads.filter(
    (l) =>
      !isWonStage(l.stage) &&
      l.stage !== "LOST" &&
      new Date(l.updatedAt) < staleDate,
  ).length;

  const cycleDays = won
    .filter((l) => l.convertedAt)
    .map((l) => (new Date(l.convertedAt!).getTime() - new Date(l.createdAt).getTime()) / 86400000);
  const avgSalesCycleDays =
    cycleDays.length > 0 ? Math.round(cycleDays.reduce((a, b) => a + b, 0) / cycleDays.length) : 0;

  const stageConversions: StageConversion[] = [];
  for (let i = 0; i < CRM_KANBAN_STAGES.length - 1; i++) {
    const from = CRM_KANBAN_STAGES[i]!;
    const to = CRM_KANBAN_STAGES[i + 1]!;
    const fromCount = stageMap.get(from)?.count ?? 0;
    const toCount = stageMap.get(to)?.count ?? 0;
    const rate = fromCount > 0 ? Math.round((toCount / fromCount) * 1000) / 10 : 0;
    stageConversions.push({
      from,
      to,
      fromCount,
      toCount,
      rate,
      dropOff: Math.round((100 - rate) * 10) / 10,
    });
  }

  const funnelTotal = CRM_KANBAN_STAGES.reduce((s, st) => s + (stageMap.get(st)?.count ?? 0), 0);
  const funnelStages = CRM_KANBAN_STAGES.map((st) => {
    const count = stageMap.get(st)?.count ?? 0;
    return {
      stage: st,
      count,
      rate: funnelTotal > 0 ? Math.round((count / funnelTotal) * 1000) / 10 : 0,
    };
  });

  const agingBuckets: AgingBucket[] = [
    { label: "0–7 days", count: 0, value: 0 },
    { label: "8–14 days", count: 0, value: 0 },
    { label: "15–30 days", count: 0, value: 0 },
    { label: "30+ days", count: 0, value: 0 },
  ];
  for (const l of open) {
    const days = Math.floor((now.getTime() - new Date(l.updatedAt).getTime()) / 86400000);
    const val = toNumber(l.value);
    const idx = days <= 7 ? 0 : days <= 14 ? 1 : days <= 30 ? 2 : 3;
    agingBuckets[idx]!.count += 1;
    agingBuckets[idx]!.value += val;
  }

  const exportLeads = open.filter((l) => l.country && l.country.toLowerCase() !== "india");
  const distributorLeads = open.filter(
    (l) => l.leadSource === "DISTRIBUTOR" || Boolean(l.distributorName),
  );
  const sampleLeads = leads.filter((l) => l.sampleStatus != null || l.stage === "SAMPLE_SENT");

  return {
    totalLeads,
    pipelineValue,
    wonValue,
    forecastValue,
    weightedForecast: Math.round(weightedForecast),
    conversionRate: totalLeads > 0 ? Math.round((won.length / totalLeads) * 1000) / 10 : 0,
    avgSalesCycleDays,
    byStage: Array.from(stageMap.entries()).map(([stage, v]) => ({ stage, ...v })),
    bySource: Array.from(sourceMap.entries()).map(([source, count]) => ({ source, count })),
    byAssignee: Array.from(assigneeMap.entries()).map(([name, v]) => ({ name, ...v })),
    staleCount,
    overdueFollowUps,
    stageConversions,
    funnelStages,
    agingLeads: agingBuckets,
    exportPipeline: {
      count: exportLeads.length,
      value: exportLeads.reduce((s, l) => s + toNumber(l.value), 0),
      weighted: exportLeads.reduce((s, l) => s + getWeightedValue(toNumber(l.value), l.stage), 0),
    },
    distributorPipeline: {
      count: distributorLeads.length,
      value: distributorLeads.reduce((s, l) => s + toNumber(l.value), 0),
      weighted: distributorLeads.reduce((s, l) => s + getWeightedValue(toNumber(l.value), l.stage), 0),
    },
    samplePipeline: {
      count: sampleLeads.length,
      inSampleStage: leads.filter((l) => normalizeStage(l.stage) === "SAMPLE_SENT").length,
    },
  };
}

export async function getWorkloadByAssignee() {
  const rows = await prisma.lead.groupBy({
    by: ["assigneeId"],
    where: { stage: { notIn: ["WON", "CONVERTED", "LOST"] } },
    _count: true,
  });
  const userIds = rows.map((r) => r.assigneeId).filter(Boolean) as string[];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true },
  });
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  return rows.map((r) => ({
    assigneeId: r.assigneeId,
    name: r.assigneeId ? userMap[r.assigneeId] ?? "Unknown" : "Unassigned",
    count: r._count,
  }));
}

function buildLastActivity(
  comm?: { channel: CommunicationChannel; sentAt: Date; message: string } | null,
): CrmLastActivity {
  if (!comm) return null;
  return {
    channel: comm.channel.replace("_", " "),
    at: comm.sentAt.toISOString(),
    preview: comm.message.slice(0, 80),
  };
}

export function serializeCrmLead(lead: {
  id: string;
  company: string;
  contactName: string;
  email: string | null;
  phone: string;
  stage: LeadStage;
  priority: import("@prisma/client").LeadPriority;
  leadSource: import("@prisma/client").LeadSource | null;
  products: string | null;
  volume: string | null;
  value: unknown;
  country: string | null;
  moq: string | null;
  packagingPreference: string | null;
  shippingTerms: string | null;
  certifications: string | null;
  distributorName: string | null;
  productCategories: string | null;
  tastingFeedback: string | null;
  followUpAt: Date | null;
  lastContactAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  assignee: { id: string; name: string } | null;
  _count?: { communications: number; tasks: number };
  tasks?: { status: string }[];
  communications?: { channel: CommunicationChannel; sentAt: Date; message: string }[];
}): import("@/lib/crm-types").CrmLeadDto {
  const staleDate = new Date(Date.now() - STALE_LEAD_DAYS * 86400000);
  const pendingTasks =
    lead.tasks?.filter((t) => t.status === "PENDING").length ??
    (lead._count?.tasks ?? 0);
  const val = lead.value != null ? toNumber(lead.value) : null;
  const probability = Math.round(getStageProbability(lead.stage) * 100);
  const ageDays = Math.floor((Date.now() - lead.updatedAt.getTime()) / 86400000);
  const lastComm = lead.communications?.[0];

  return {
    id: lead.id,
    company: lead.company,
    contactName: lead.contactName,
    email: lead.email,
    phone: lead.phone,
    stage: lead.stage,
    priority: lead.priority,
    leadSource: lead.leadSource,
    products: lead.products,
    volume: lead.volume,
    value: val,
    country: lead.country,
    moq: lead.moq,
    packagingPreference: lead.packagingPreference,
    shippingTerms: lead.shippingTerms,
    certifications: lead.certifications,
    distributorName: lead.distributorName,
    productCategories: lead.productCategories,
    tastingFeedback: lead.tastingFeedback,
    followUpAt: lead.followUpAt?.toISOString() ?? null,
    lastContactAt: lead.lastContactAt?.toISOString() ?? null,
    createdAt: lead.createdAt.toISOString(),
    updatedAt: lead.updatedAt.toISOString(),
    assignee: lead.assignee,
    commCount: lead._count?.communications ?? 0,
    taskCount: lead._count?.tasks ?? 0,
    pendingTasks,
    isStale:
      !isWonStage(lead.stage) &&
      lead.stage !== "LOST" &&
      lead.updatedAt < staleDate,
    probability,
    weightedValue: getWeightedValue(val, lead.stage),
    ageDays,
    lastActivity: buildLastActivity(lastComm),
  };
}
