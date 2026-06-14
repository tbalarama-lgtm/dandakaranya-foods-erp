"use client";

import { motion } from "framer-motion";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles, TrendingDown, TrendingUp } from "lucide-react";
import type { CrmAnalytics } from "@/lib/crm-metrics";
import type { CrmLeadDto } from "@/lib/crm-types";
import { CRM_SOURCE_LABELS, CRM_STAGE_LABELS, normalizeStage } from "@/lib/crm-types";
import { generateCrmInsights } from "@/lib/crm-insights";
import { LeadFunnelChart } from "@/components/reports/lead-funnel-chart";
import { formatInr } from "@/lib/utils";
import { cn } from "@/lib/utils";

const SEVERITY_STYLES = {
  info: "border-blue-500/30 bg-blue-500/5",
  positive: "border-emerald-500/30 bg-emerald-500/5",
  warning: "border-amber-500/30 bg-amber-500/5",
  critical: "border-red-500/30 bg-red-500/5",
};

export function CrmAnalyticsPanel({
  analytics,
  leads,
}: {
  analytics: CrmAnalytics;
  leads: CrmLeadDto[];
}) {
  const insights = generateCrmInsights(analytics, leads);

  const stageChart = analytics.byStage.map((s) => ({
    name: CRM_STAGE_LABELS[normalizeStage(s.stage)],
    count: s.count,
    value: s.value,
    weighted: s.weighted,
  }));

  const sourceChart = analytics.bySource.map((s) => ({
    name: CRM_SOURCE_LABELS[s.source as keyof typeof CRM_SOURCE_LABELS] ?? s.source,
    count: s.count,
  }));

  const dropOffChart = analytics.stageConversions.map((c) => ({
    name: `${CRM_STAGE_LABELS[c.from].slice(0, 8)}→${CRM_STAGE_LABELS[c.to].slice(0, 8)}`,
    rate: c.rate,
    dropOff: c.dropOff,
  }));

  const funnelStages = analytics.funnelStages.map((s) => ({
    stage: CRM_STAGE_LABELS[normalizeStage(s.stage as import("@prisma/client").LeadStage)],
    count: s.count,
    rate: s.rate,
  }));

  const kpis = [
    { label: "Total leads", value: String(analytics.totalLeads) },
    { label: "Pipeline value", value: formatInr(analytics.pipelineValue) },
    { label: "Weighted forecast", value: formatInr(analytics.weightedForecast), highlight: true },
    { label: "Won value", value: formatInr(analytics.wonValue) },
    { label: "Conversion", value: `${analytics.conversionRate}%` },
    { label: "Sales velocity", value: analytics.avgSalesCycleDays ? `${analytics.avgSalesCycleDays} days` : "—" },
    { label: "Stale leads", value: String(analytics.staleCount), warn: analytics.staleCount > 0 },
    { label: "Sample pipeline", value: String(analytics.samplePipeline.inSampleStage) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            className="erp-kpi-card p-4"
          >
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</p>
            <p className={`mt-1 text-lg font-semibold ${k.warn ? "text-amber-600" : k.highlight ? "text-[#B68D40]" : ""}`}>
              {k.value}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="erp-kpi-card p-5">
          <LeadFunnelChart
            stages={funnelStages}
            conversionRate={analytics.conversionRate}
            forecast={analytics.weightedForecast}
          />
        </div>

        <div className="erp-kpi-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-[#B68D40]" />
            AI conversion insights
          </h3>
          <ul className="mt-4 max-h-[320px] space-y-2 overflow-y-auto">
            {insights.map((insight, i) => (
              <motion.li
                key={insight.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className={cn("rounded-xl border p-3", SEVERITY_STYLES[insight.severity])}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-sm font-semibold">{insight.title}</p>
                  {insight.prediction != null && (
                    <span className="shrink-0 rounded-md bg-background/80 px-2 py-0.5 text-xs font-bold">
                      {insight.prediction}%
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{insight.body}</p>
              </motion.li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="erp-kpi-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold">Stage conversion & drop-offs</h3>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dropOffChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} unit="%" />
                <Tooltip formatter={(v, name) => [`${v}%`, name === "rate" ? "Conversion" : "Drop-off"]} />
                <Bar dataKey="rate" name="rate" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="dropOff" name="dropOff" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Aging leads</h3>
          <ul className="mt-4 space-y-2">
            {analytics.agingLeads.map((b) => (
              <li key={b.label} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <span>{b.label}</span>
                <span className="font-semibold">
                  {b.count} · {formatInr(b.value)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Pipeline by stage (weighted)</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stageChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#B68D40" radius={[4, 4, 0, 0]} />
                <Bar dataKey="weighted" fill="#1E3A5F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Lead sources</h3>
          <div className="mt-4 h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={sourceChart} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                  {sourceChart.map((_, i) => (
                    <Cell key={i} fill={i % 2 === 0 ? "#1E3A5F" : "#B68D40"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="erp-kpi-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            Export sales pipeline
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Open export leads</dt>
              <dd className="font-semibold">{analytics.exportPipeline.count}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Pipeline value</dt>
              <dd>{formatInr(analytics.exportPipeline.value)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Weighted forecast</dt>
              <dd className="font-semibold text-[#B68D40]">{formatInr(analytics.exportPipeline.weighted)}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Tracks MOQ negotiations, certification approvals, packaging discussions, and sample dispatch.
          </p>
        </div>

        <div className="erp-kpi-card p-5">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <TrendingDown className="h-4 w-4 text-blue-600" />
            Distributor onboarding
          </h3>
          <dl className="mt-3 space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Active distributor leads</dt>
              <dd className="font-semibold">{analytics.distributorPipeline.count}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Pipeline value</dt>
              <dd>{formatInr(analytics.distributorPipeline.value)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Weighted forecast</dt>
              <dd className="font-semibold text-[#B68D40]">{formatInr(analytics.distributorPipeline.weighted)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="erp-kpi-card p-5">
        <h3 className="text-sm font-semibold">Team workload & weighted pipeline</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="pb-2">Rep</th>
                <th className="pb-2">Open leads</th>
                <th className="pb-2">Pipeline value</th>
                <th className="pb-2">Weighted</th>
              </tr>
            </thead>
            <tbody>
              {analytics.byAssignee.map((a) => (
                <tr key={a.name} className="border-b border-border/40">
                  <td className="py-2 font-medium">{a.name}</td>
                  <td className="py-2">{a.count}</td>
                  <td className="py-2">{formatInr(a.value)}</td>
                  <td className="py-2 font-semibold text-[#B68D40]">{formatInr(a.weighted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {analytics.overdueFollowUps > 0 && (
          <p className="mt-3 text-xs text-amber-600">
            {analytics.overdueFollowUps} overdue follow-up{analytics.overdueFollowUps !== 1 ? "s" : ""} require attention
          </p>
        )}
      </div>
    </div>
  );
}
