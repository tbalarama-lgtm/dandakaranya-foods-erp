"use client";

import { motion } from "framer-motion";
import type { CrmAnalytics } from "@/lib/crm-metrics";
import { formatInr } from "@/lib/utils";

export function CrmPipelineHeader({ analytics }: { analytics: CrmAnalytics }) {
  const kpis = [
    { label: "Open pipeline", value: formatInr(analytics.pipelineValue) },
    { label: "Weighted forecast", value: formatInr(analytics.weightedForecast), highlight: true },
    { label: "Conversion rate", value: `${analytics.conversionRate}%` },
    { label: "Sales velocity", value: analytics.avgSalesCycleDays ? `${analytics.avgSalesCycleDays}d` : "—" },
    { label: "Export pipeline", value: String(analytics.exportPipeline.count) },
    { label: "Distributor", value: String(analytics.distributorPipeline.count) },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {kpis.map((k, i) => (
        <motion.div
          key={k.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</p>
          <p className={`mt-0.5 text-sm font-bold ${k.highlight ? "text-[#B68D40]" : ""}`}>{k.value}</p>
        </motion.div>
      ))}
    </div>
  );
}
