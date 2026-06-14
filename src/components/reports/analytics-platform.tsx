"use client";

import { motion } from "framer-motion";
import type { AnalyticsReportMetrics } from "@/lib/analytics-types";
import { generateBusinessInsights } from "@/lib/analytics-insights";
import { AnalyticsKpis } from "@/components/reports/analytics-kpis";
import { AnalyticsCharts } from "@/components/reports/analytics-charts";
import { AnalyticsToolbar, AiInsightsPanel } from "@/components/reports/analytics-toolbar";

export function AnalyticsPlatform({
  metrics,
  from,
  to,
  preset,
  branchId,
}: {
  metrics: AnalyticsReportMetrics;
  from: string;
  to: string;
  preset: string;
  branchId?: string;
}) {
  const insights = generateBusinessInsights(metrics);

  return (
    <div className="space-y-6">
      <AnalyticsToolbar
        metrics={metrics}
        from={from}
        to={to}
        preset={preset}
        branchId={branchId}
      />

      <AnalyticsKpis metrics={metrics} />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
          <AnalyticsCharts metrics={metrics} />
        </motion.div>
        <div className="xl:sticky xl:top-4 xl:self-start">
          <AiInsightsPanel insights={insights} />
        </div>
      </div>
    </div>
  );
}
