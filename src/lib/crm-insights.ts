import type { CrmAnalytics } from "@/lib/crm-metrics";
import type { CrmLeadDto } from "@/lib/crm-types";
import { CRM_STAGE_LABELS, normalizeStage } from "@/lib/crm-types";
import { formatInr } from "@/lib/utils";

export type CrmInsight = {
  id: string;
  severity: "info" | "positive" | "warning" | "critical";
  title: string;
  body: string;
  prediction?: number;
};

/** Rule-based conversion prediction for a single lead (0–100) */
export function predictLeadConversion(lead: CrmLeadDto): number {
  let score = lead.probability;

  if (lead.priority === "URGENT") score += 8;
  else if (lead.priority === "HIGH") score += 5;
  else if (lead.priority === "LOW") score -= 5;

  if (lead.isStale) score -= 15;
  if (lead.pendingTasks > 0) score += 3;
  if (lead.commCount >= 3) score += 5;
  if (lead.lastContactAt) {
    const daysSince = Math.floor(
      (Date.now() - new Date(lead.lastContactAt).getTime()) / 86400000,
    );
    if (daysSince <= 7) score += 5;
    else if (daysSince > 21) score -= 10;
  }
  if (lead.followUpAt && new Date(lead.followUpAt) < new Date()) score -= 8;
  if (lead.country && lead.country.toLowerCase() !== "india") score += 3;
  if (lead.distributorName) score += 4;

  return Math.max(5, Math.min(95, Math.round(score)));
}

export function generateCrmInsights(
  analytics: CrmAnalytics,
  leads: CrmLeadDto[],
): CrmInsight[] {
  const insights: CrmInsight[] = [];
  const open = leads.filter(
    (l) => !["WON", "CONVERTED", "LOST", "DORMANT"].includes(l.stage),
  );

  if (analytics.conversionRate < 20 && analytics.totalLeads > 3) {
    insights.push({
      id: "conv-low",
      severity: "warning",
      title: "Pipeline conversion below benchmark",
      body: `Overall win rate is ${analytics.conversionRate}%. Focus on moving ${analytics.byStage.find((s) => normalizeStage(s.stage) === "NEGOTIATION")?.count ?? 0} negotiation-stage deals to sample or proposal closure.`,
      prediction: analytics.conversionRate,
    });
  } else if (analytics.conversionRate >= 25) {
    insights.push({
      id: "conv-strong",
      severity: "positive",
      title: "Strong conversion performance",
      body: `${analytics.conversionRate}% of leads convert to won deals. Weighted forecast: ${formatInr(analytics.weightedForecast)}.`,
      prediction: analytics.conversionRate,
    });
  }

  const worstDrop = [...analytics.stageConversions].sort((a, b) => b.dropOff - a.dropOff)[0];
  if (worstDrop && worstDrop.dropOff > 40 && worstDrop.fromCount >= 2) {
    insights.push({
      id: "dropoff",
      severity: "info",
      title: "Stage drop-off detected",
      body: `${worstDrop.dropOff}% of leads drop between ${CRM_STAGE_LABELS[worstDrop.from]} and ${CRM_STAGE_LABELS[worstDrop.to]}. Review qualification criteria and follow-up SLAs.`,
    });
  }

  if (analytics.avgSalesCycleDays > 0) {
    insights.push({
      id: "velocity",
      severity: "info",
      title: "Sales velocity",
      body: `Average time from lead creation to win is ${analytics.avgSalesCycleDays} days. Shorter cycles in Sample Sent stage typically improve export close rates.`,
      prediction: analytics.avgSalesCycleDays,
    });
  }

  if (analytics.staleCount > 0) {
    insights.push({
      id: "stale",
      severity: "critical",
      title: "Stale leads need escalation",
      body: `${analytics.staleCount} open lead(s) have had no activity for 14+ days. Reassign or schedule follow-ups to prevent pipeline decay.`,
    });
  }

  if (analytics.exportPipeline.count > 0) {
    insights.push({
      id: "export",
      severity: "positive",
      title: "Export pipeline active",
      body: `${analytics.exportPipeline.count} export enquiries worth ${formatInr(analytics.exportPipeline.value)} (${formatInr(analytics.exportPipeline.weighted)} weighted). Prioritize MOQ, certification, and packaging discussions.`,
      prediction: Math.round(
        (analytics.exportPipeline.weighted / Math.max(analytics.exportPipeline.value, 1)) * 100,
      ),
    });
  }

  if (analytics.distributorPipeline.count > 0) {
    insights.push({
      id: "distributor",
      severity: "info",
      title: "Distributor onboarding pipeline",
      body: `${analytics.distributorPipeline.count} distributor lead(s) in pipeline. Weighted value: ${formatInr(analytics.distributorPipeline.weighted)}.`,
    });
  }

  const highPotential = open
    .map((l) => ({ lead: l, prediction: predictLeadConversion(l) }))
    .filter((x) => x.prediction >= 60)
    .sort((a, b) => b.prediction - a.prediction)
    .slice(0, 3);

  for (const { lead, prediction } of highPotential) {
    insights.push({
      id: `predict-${lead.id}`,
      severity: "positive",
      title: `High conversion potential: ${lead.company}`,
      body: `AI score ${prediction}% — ${CRM_STAGE_LABELS[normalizeStage(lead.stage)]} stage, ${lead.probability}% base probability. ${lead.value ? `Deal value ${formatInr(lead.value)}.` : "Add deal value for forecasting."}`,
      prediction,
    });
  }

  const aging30 = analytics.agingLeads.find((b) => b.label === "30+ days");
  if (aging30 && aging30.count > 0) {
    insights.push({
      id: "aging",
      severity: "warning",
      title: "Aging pipeline risk",
      body: `${aging30.count} lead(s) unchanged for 30+ days (${formatInr(aging30.value)} at risk). Consider dormant stage or re-engagement campaigns.`,
    });
  }

  return insights.slice(0, 8);
}
