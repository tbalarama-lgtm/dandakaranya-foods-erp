"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft } from "lucide-react";
import type { AnalyticsReportMetrics } from "@/lib/analytics-types";
import { formatInr } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";

type Stage = { stage: string; count: number; rate?: number };

export function LeadFunnelChart({
  stages,
  conversionRate,
  forecast,
}: {
  stages: Stage[];
  conversionRate: number;
  forecast?: number;
}) {
  const max = Math.max(...stages.map((s) => s.count), 1);
  const [selected, setSelected] = useState<Stage | null>(null);

  return (
    <div className="flex h-full min-h-[280px] flex-col">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-muted-foreground">Conversion funnel</p>
          <p className="text-lg font-semibold">{conversionRate}% overall conversion</p>
        </div>
        {forecast != null && (
          <div className="rounded-lg bg-[#B68D40]/10 px-3 py-1.5 text-right">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Forecast</p>
            <p className="text-sm font-semibold text-[#B68D40]">{formatInr(forecast)}</p>
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {selected ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            className="flex flex-1 flex-col justify-center rounded-xl border border-border/60 bg-muted/20 p-4"
          >
            <button
              type="button"
              className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setSelected(null)}
            >
              <ChevronLeft className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
              Back to funnel
            </button>
            <p className="text-sm font-semibold">{selected.stage}</p>
            <p className="mt-2 text-3xl font-bold">{selected.count}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {selected.rate ?? 0}% of total pipeline volume
            </p>
            <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
              Drill-down: focus sales follow-ups on leads in this stage. Conversion to next stage
              improves forecast accuracy for revenue planning.
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="funnel"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col justify-center gap-2 py-2"
          >
            {stages.map((s, i) => {
              const widthPct = 40 + (s.count / max) * 60;
              return (
                <motion.button
                  key={s.stage}
                  type="button"
                  initial={{ opacity: 0, scaleX: 0.85 }}
                  animate={{ opacity: 1, scaleX: 1 }}
                  transition={{ delay: i * 0.08, duration: 0.4 }}
                  whileHover={{ scale: 1.02 }}
                  onClick={() => setSelected(s)}
                  className="group relative mx-auto overflow-hidden rounded-lg border border-[#B68D40]/20 bg-gradient-to-r from-[#1E3A5F] to-[#2A4A6F] py-3 text-center text-white shadow-sm transition-shadow hover:shadow-md"
                  style={{ width: `${widthPct}%`, minWidth: "55%" }}
                >
                  <span className="absolute inset-0 bg-[#B68D40]/15 opacity-0 transition-opacity group-hover:opacity-100" />
                  <span className="relative block text-xs font-medium uppercase tracking-wider opacity-80">
                    {s.stage}
                  </span>
                  <span className="relative mt-0.5 block text-lg font-bold">{s.count}</span>
                  <span className="relative text-[10px] opacity-70">{s.rate ?? 0}%</span>
                </motion.button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** Backward-compatible wrapper for simple stage/count arrays */
export function LeadPipelineChart({
  data,
  conversionRate,
  forecast,
}: {
  data: { stage: string; count: number; rate?: number }[];
  conversionRate?: number;
  forecast?: number;
}) {
  const rate =
    conversionRate ??
    (() => {
      const total = data.reduce((s, d) => s + d.count, 0);
      const converted = data.find((d) => d.stage.toLowerCase().includes("convert"))?.count ?? 0;
      return total > 0 ? Math.round((converted / total) * 1000) / 10 : 0;
    })();

  return <LeadFunnelChart stages={data} conversionRate={rate} forecast={forecast} />;
}

export function SalesForecastChart({
  trend,
  forecast,
}: {
  trend: AnalyticsReportMetrics["revenueTrend"];
  forecast: AnalyticsReportMetrics["forecast"];
}) {
  const chartData = useMemo(() => {
    const historical = trend.map((t) => ({ label: t.month, value: t.revenue, type: "Actual" }));
    const lastMonth = trend[trend.length - 1]?.month ?? "Now";
    const forecastPoints = forecast.series.map((v, i) => ({
      label: i === 0 ? `${lastMonth}+` : `F${i + 1}`,
      value: v,
      type: "Forecast",
    }));
    return [...historical, ...forecastPoints];
  }, [trend, forecast]);

  const max = Math.max(...chartData.map((d) => d.value), 1);

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        Next month projection:{" "}
        <span className="font-semibold text-foreground">{formatInr(forecast.nextMonthRevenue)}</span>
      </p>
      <div className="flex h-32 items-end gap-1.5">
        {chartData.map((d, i) => (
          <motion.div
            key={`${d.label}-${i}`}
            initial={{ height: 0 }}
            animate={{ height: `${(d.value / max) * 100}%` }}
            transition={{ delay: i * 0.05, duration: 0.5 }}
            className="group relative flex-1 min-w-0"
          >
            <div
              className={`h-full w-full rounded-t-md ${
                d.type === "Forecast"
                  ? "border border-dashed border-[#B68D40] bg-[#B68D40]/25"
                  : "bg-[#B68D40]"
              }`}
              title={`${d.label}: ${formatInr(d.value)}`}
            />
            <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 truncate text-[9px] text-muted-foreground">
              {d.label}
            </span>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
