import { apiHandler, jsonOk } from "@/lib/api/handler";
import { getReportMetrics, parseReportRange } from "@/lib/reports";
import { metricsToCsv } from "@/lib/export-analytics";
import { logActivity } from "@/lib/activity";
import { ActivityAction } from "@prisma/client";

export const GET = apiHandler(
  async (_ctx, request) => {
    const { searchParams } = new URL(request.url);
    const range = parseReportRange(
      searchParams.get("from") ?? undefined,
      searchParams.get("to") ?? undefined,
      searchParams.get("preset") ?? undefined,
      searchParams.get("branch") ?? undefined,
    );
    const format = searchParams.get("format") ?? "json";
    const metrics = await getReportMetrics(range);

    await logActivity({
      action: ActivityAction.EXPORT,
      entityType: "Report",
      message: `Exported business report (${format})`,
      metadata: { range, format },
    });

    if (format === "json") return jsonOk(metrics);

    if (format === "csv" || format === "excel") {
      const csv = metricsToCsv(metrics);
      const contentType =
        format === "excel"
          ? "application/vnd.ms-excel; charset=utf-8"
          : "text/csv; charset=utf-8";
      return new Response(csv.replace(/,/g, format === "excel" ? "\t" : ","), {
        headers: {
          "Content-Type": contentType,
          "Content-Disposition": `attachment; filename="analytics-${Date.now()}.${format === "excel" ? "xls" : "csv"}"`,
        },
      });
    }

    return jsonOk({
      message: "Use format=csv|excel|json. PDF export is available from the reports UI.",
      metrics,
    });
  },
  { permission: "reports.view" },
);
