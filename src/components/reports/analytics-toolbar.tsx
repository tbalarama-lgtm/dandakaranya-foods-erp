"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
import {
  Calendar,
  CalendarClock,
  Download,
  FileSpreadsheet,
  FileText,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { REPORT_PRESETS } from "@/lib/report-presets";
import type { AnalyticsReportMetrics } from "@/lib/analytics-types";
import { downloadCsv, downloadExcel, downloadPdf } from "@/lib/export-analytics";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { toast } from "sonner";
import { ScheduledReportsDialog } from "@/components/reports/scheduled-reports-dialog";

export function AnalyticsToolbar({
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
  const router = useRouter();
  const searchParams = useSearchParams();
  const [schedOpen, setSchedOpen] = useState(false);

  const apply = (updates: Record<string, string | undefined>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.push(`/reports?${params.toString()}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="erp-kpi-card flex flex-col gap-4 p-4 lg:flex-row lg:flex-wrap lg:items-end lg:justify-between"
    >
      <div className="flex flex-wrap gap-2">
        {REPORT_PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={preset === p.id ? "premium" : "secondary"}
            onClick={() => apply({ preset: p.id, from: undefined, to: undefined })}
          >
            {p.label}
          </Button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label htmlFor="report-from" className="text-xs">
            From
          </Label>
          <input
            id="report-from"
            type="date"
            defaultValue={from}
            className="mt-1 flex h-9 rounded-lg border border-border bg-background px-2 text-sm"
          />
        </div>
        <div>
          <Label htmlFor="report-to" className="text-xs">
            To
          </Label>
          <input
            id="report-to"
            type="date"
            defaultValue={to}
            className="mt-1 flex h-9 rounded-lg border border-border bg-background px-2 text-sm"
          />
        </div>
        <div className="min-w-[140px]">
          <Label htmlFor="report-branch" className="text-xs">
            Branch
          </Label>
          <select
            id="report-branch"
            defaultValue={branchId ?? ""}
            className="mt-1 flex h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
            onChange={(e) => apply({ branch: e.target.value || undefined, preset: "custom" })}
          >
            <option value="">All branches</option>
            {metrics.branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => {
            const fromEl = document.getElementById("report-from") as HTMLInputElement;
            const toEl = document.getElementById("report-to") as HTMLInputElement;
            apply({
              from: fromEl?.value,
              to: toEl?.value,
              preset: "custom",
            });
          }}
        >
          <Calendar className="h-4 w-4" strokeWidth={ICON_STROKE} />
          Apply
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" onClick={() => { downloadCsv(metrics); toast.success("CSV downloaded"); }}>
          <Download className="h-4 w-4" strokeWidth={ICON_STROKE} />
          CSV
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={() => { downloadExcel(metrics); toast.success("Excel downloaded"); }}>
          <FileSpreadsheet className="h-4 w-4" strokeWidth={ICON_STROKE} />
          Excel
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={async () => {
            await downloadPdf(metrics);
            toast.success("PDF downloaded");
          }}
        >
          <FileText className="h-4 w-4" strokeWidth={ICON_STROKE} />
          PDF
        </Button>
        <Button type="button" size="sm" variant="secondary" onClick={() => setSchedOpen(true)}>
          <CalendarClock className="h-4 w-4" strokeWidth={ICON_STROKE} />
          Schedule
        </Button>
      </div>

      <ScheduledReportsDialog open={schedOpen} onOpenChange={setSchedOpen} />
    </motion.div>
  );
}

export function AiInsightsPanel({ insights }: { insights: ReturnType<typeof import("@/lib/analytics-insights").generateBusinessInsights> }) {
  const toneClass = {
    positive: "border-emerald-500/30 bg-emerald-500/8",
    warning: "border-amber-500/30 bg-amber-500/8",
    critical: "border-red-500/30 bg-red-500/8",
    info: "border-[#B68D40]/25 bg-[#B68D40]/5",
  };

  return (
    <div className="erp-kpi-card p-5">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="h-4 w-4 text-[#B68D40]" strokeWidth={ICON_STROKE} />
        AI business insights
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">
        Automated analysis of trends, risks, and opportunities
      </p>
      <ul className="mt-4 space-y-3">
        {insights.map((ins, i) => (
          <motion.li
            key={ins.id}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className={`rounded-xl border p-3 ${toneClass[ins.severity]}`}
          >
            <p className="text-sm font-semibold">{ins.title}</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{ins.body}</p>
          </motion.li>
        ))}
      </ul>
    </div>
  );
}
