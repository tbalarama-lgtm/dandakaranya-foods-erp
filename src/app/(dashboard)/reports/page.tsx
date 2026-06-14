import { format } from "date-fns";
import { PageHeader } from "@/components/layout/page-header";
import { AnalyticsPlatform } from "@/components/reports/analytics-platform";
import { getReportMetrics, parseReportRange } from "@/lib/reports";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ReportsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; preset?: string; branch?: string }>;
}) {
  await requirePermission("reports.view");
  const sp = await searchParams;
  const range = parseReportRange(sp.from, sp.to, sp.preset, sp.branch);
  const metrics = await getReportMetrics(range);

  const fromStr = format(range.from, "yyyy-MM-dd");
  const toStr = format(range.to, "yyyy-MM-dd");
  const preset = range.preset ?? "month";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Business intelligence"
        description={`Enterprise analytics · ${metrics.auditTrail.periodLabel}`}
      />
      <AnalyticsPlatform
        metrics={metrics}
        from={fromStr}
        to={toStr}
        preset={preset}
        branchId={range.branchId}
      />
    </div>
  );
}
