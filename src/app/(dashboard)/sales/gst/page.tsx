import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { getInvoiceAnalytics } from "@/lib/invoice-metrics";
import { formatInr } from "@/lib/utils";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function GstReportsPage() {
  await requirePermission("sales.view");
  const analytics = await getInvoiceAnalytics();

  return (
    <div className="space-y-6">
      <PageHeader
        title="GST reports"
        description="HSN summaries · taxable values · compliance references"
        action={{ label: "Back to billing", href: "/sales" }}
      />

      <div className="erp-kpi-card p-5">
        <h3 className="text-sm font-semibold">HSN-wise summary</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="py-2">HSN code</th>
                <th className="py-2 text-right">Taxable value</th>
                <th className="py-2 text-right">GST amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/40">
              {analytics.hsnSummary.length === 0 ? (
                <tr>
                  <td colSpan={3} className="py-6 text-center text-muted-foreground">
                    No invoice data for HSN summary yet.
                  </td>
                </tr>
              ) : (
                analytics.hsnSummary.map((row) => (
                  <tr key={row.hsn}>
                    <td className="py-2 font-mono">{row.hsn}</td>
                    <td className="py-2 text-right">{formatInr(row.taxableValue)}</td>
                    <td className="py-2 text-right">{formatInr(row.gst)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="erp-kpi-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Total GST collected</p>
          <p className="mt-1 text-xl font-bold">
            {formatInr(analytics.hsnSummary.reduce((s, r) => s + r.gst, 0))}
          </p>
        </div>
        <div className="erp-kpi-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Taxable turnover</p>
          <p className="mt-1 text-xl font-bold">{formatInr(analytics.totalRevenue)}</p>
        </div>
        <div className="erp-kpi-card p-4">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">e-Invoice / e-Way</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Record IRN and e-Way bill numbers on each invoice detail page under GST compliance.
          </p>
          <Link href="/sales" className="mt-2 inline-block text-sm font-semibold text-[#B68D40] hover:underline">
            View invoices →
          </Link>
        </div>
      </div>
    </div>
  );
}
