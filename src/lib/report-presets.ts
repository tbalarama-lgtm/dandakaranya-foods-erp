import {
  endOfDay,
  endOfMonth,
  endOfQuarter,
  endOfWeek,
  startOfDay,
  startOfMonth,
  startOfQuarter,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";

export type ReportPreset = "week" | "month" | "quarter" | "fy" | "custom";

export type ReportDateRange = {
  from: Date;
  to: Date;
  preset: ReportPreset;
};

/** Indian financial year: April 1 – March 31 */
function indianFyRange(now: Date): { from: Date; to: Date } {
  const year = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return {
    from: startOfDay(new Date(year, 3, 1)),
    to: endOfDay(now),
  };
}

export function parseReportRange(
  fromStr?: string,
  toStr?: string,
  preset?: string,
  branchId?: string,
): ReportDateRange & { branchId?: string } {
  const now = new Date();
  let from: Date;
  let to: Date = endOfDay(now);
  let resolvedPreset: ReportPreset = "custom";

  if (preset === "week") {
    from = startOfWeek(now, { weekStartsOn: 1 });
    to = endOfWeek(now, { weekStartsOn: 1 });
    resolvedPreset = "week";
  } else if (preset === "month") {
    from = startOfMonth(now);
    to = endOfMonth(now);
    resolvedPreset = "month";
  } else if (preset === "quarter") {
    from = startOfQuarter(now);
    to = endOfQuarter(now);
    resolvedPreset = "quarter";
  } else if (preset === "fy") {
    const fy = indianFyRange(now);
    from = fy.from;
    to = fy.to;
    resolvedPreset = "fy";
  } else if (fromStr || toStr) {
    from = fromStr ? startOfDay(new Date(fromStr)) : startOfMonth(now);
    to = toStr ? endOfDay(new Date(toStr)) : endOfDay(now);
    resolvedPreset = "custom";
  } else {
    from = startOfMonth(now);
    resolvedPreset = "month";
  }

  return { from, to, preset: resolvedPreset, branchId: branchId || undefined };
}

export function previousPeriodRange(range: ReportDateRange): ReportDateRange {
  const days = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / 86400000));
  const to = endOfDay(new Date(range.from.getTime() - 86400000));
  const from = startOfDay(new Date(to.getTime() - (days - 1) * 86400000));
  return { from, to, preset: range.preset };
}

export const REPORT_PRESETS: { id: ReportPreset; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "quarter", label: "Quarter" },
  { id: "fy", label: "Financial year" },
];

export function pctChange(current: number, previous: number) {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

/** Simple linear forecast for next 3 periods */
export function forecastSeries(values: number[], periods = 3): number[] {
  if (values.length < 2) return Array(periods).fill(values[0] ?? 0);
  const n = values.length;
  const avgDelta = (values[n - 1] - values[0]) / (n - 1);
  return Array.from({ length: periods }, (_, i) =>
    Math.max(0, Math.round(values[n - 1] + avgDelta * (i + 1))),
  );
}
