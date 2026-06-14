"use client";

import { motion } from "framer-motion";
import { TrendingDown, TrendingUp } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import type { AnalyticsReportMetrics } from "@/lib/analytics-types";
import { formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";

type KpiDef = {
  label: string;
  value: string;
  sub: string;
  trend: number;
  spark: number[];
  accent: string;
  invertTrend?: boolean;
};

export function AnalyticsKpis({ metrics }: { metrics: AnalyticsReportMetrics }) {
  const kpis: KpiDef[] = [
    {
      label: "Total revenue",
      value: formatInr(metrics.totalSales),
      sub: `${metrics.growth.revenuePct >= 0 ? "+" : ""}${metrics.growth.revenuePct}% vs prior`,
      trend: metrics.growth.revenuePct,
      spark: metrics.sparklines.revenue,
      accent: "#B68D40",
    },
    {
      label: "Profit margin",
      value: `${metrics.profitMargin.toFixed(1)}%`,
      sub: `Net ${formatInr(metrics.profit)}`,
      trend: metrics.growth.profitPct,
      spark: metrics.sparklines.profit,
      accent: "#10B981",
    },
    {
      label: "Expenses",
      value: formatInr(metrics.expensesTotal),
      sub: `${metrics.growth.expensesPct >= 0 ? "+" : ""}${metrics.growth.expensesPct}% spend`,
      trend: metrics.growth.expensesPct,
      spark: metrics.sparklines.expenses,
      accent: "#F59E0B",
      invertTrend: true,
    },
    {
      label: "Procurement",
      value: formatInr(metrics.totalPurchases),
      sub: `${metrics.procurement.vendorCount} active vendors`,
      trend: metrics.growth.purchasesPct,
      spark: metrics.procurement.rawMaterialTrend.map((r) => r.amount),
      accent: "#3B82F6",
      invertTrend: true,
    },
    {
      label: "GST net liability",
      value: formatInr(metrics.gstSummary.net),
      sub: `Collected ${formatInr(metrics.gstSummary.collected)}`,
      trend: metrics.gstSummary.net >= 0 ? 2.4 : -2.4,
      spark: metrics.sparklines.revenue.map((v, i) => v * 0.18 - (metrics.sparklines.expenses[i] ?? 0) * 0.05),
      accent: "#8B5CF6",
    },
    {
      label: "Lead conversion",
      value: `${metrics.leadFunnel.conversionRate}%`,
      sub: `${metrics.leadFunnel.total} leads · forecast ${formatInr(metrics.forecast.nextMonthRevenue)}`,
      trend: metrics.leadFunnel.conversionRate,
      spark: metrics.leadFunnel.stages.map((s) => s.count),
      accent: "#EC4899",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {kpis.map((kpi, i) => (
        <motion.div
          key={kpi.label}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.04, duration: 0.35 }}
          whileHover={{ y: -3 }}
          className="erp-kpi-card overflow-hidden p-4"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                {kpi.label}
              </p>
              <p className="mt-1.5 truncate text-lg font-semibold tracking-tight">{kpi.value}</p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">{kpi.sub}</p>
            </div>
            <TrendBadge trend={kpi.trend} invert={kpi.invertTrend} />
          </div>
          <div className="mt-3 h-10 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={kpi.spark.map((v, idx) => ({ v, idx }))}>
                <Line
                  type="monotone"
                  dataKey="v"
                  stroke={kpi.accent}
                  strokeWidth={2}
                  dot={false}
                  animationDuration={900}
                  animationEasing="ease-out"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      ))}
    </div>
  );
}

function TrendBadge({ trend, invert }: { trend: number; invert?: boolean }) {
  const positive = invert ? trend <= 0 : trend >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
        positive
          ? "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400"
          : "bg-red-500/12 text-red-600 dark:text-red-400",
      )}
    >
      <Icon className="h-3 w-3" strokeWidth={ICON_STROKE} />
      {Math.abs(trend).toFixed(1)}%
    </span>
  );
}
