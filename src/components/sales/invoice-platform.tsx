"use client";

import { Suspense } from "react";
import Link from "next/link";
import { FileText, Plus, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InvoiceFilters } from "@/components/sales/invoice-filters";
import { InvoiceKpis } from "@/components/sales/invoice-kpis";
import { InvoiceTable } from "@/components/sales/invoice-table";
import { EmptyState } from "@/components/shared/empty-state";
import type { InvoiceAnalytics, InvoiceListDto } from "@/lib/invoice-types";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { formatInr } from "@/lib/utils";

export function InvoicePlatform({
  invoices,
  analytics,
}: {
  invoices: InvoiceListDto[];
  analytics: InvoiceAnalytics;
}) {
  return (
    <div className="space-y-6">
      <InvoiceKpis analytics={analytics} />

      <Suspense fallback={null}>
        <InvoiceFilters />
      </Suspense>

      {analytics.aging.some((a) => a.count > 0) && (
        <div className="erp-kpi-card p-4">
          <h3 className="text-sm font-semibold">Aging analysis</h3>
          <div className="mt-3 grid gap-2 sm:grid-cols-4">
            {analytics.aging.map((a) => (
              <div key={a.bucket} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{a.bucket}</p>
                <p className="font-semibold">{a.count} invoices</p>
                <p className="text-xs text-muted-foreground">{formatInr(a.amount)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{invoices.length} invoice(s)</p>
        <div className="flex gap-2">
          <Button variant="secondary" asChild>
            <Link href="/sales/gst">
              <BarChart3 className="h-4 w-4" strokeWidth={ICON_STROKE} />
              GST reports
            </Link>
          </Button>
          <Button variant="secondary" asChild>
            <Link href="/sales/orders">Sales orders</Link>
          </Button>
          <Button variant="premium" asChild>
            <Link href="/sales/new">
              <Plus className="h-4 w-4" strokeWidth={ICON_STROKE} />
              New invoice
            </Link>
          </Button>
        </div>
      </div>

      {invoices.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No invoices yet"
          description="Create tax invoices with GST breakup, payment tracking, and PDF export."
          action={{ label: "New invoice", href: "/sales/new" }}
        />
      ) : (
        <InvoiceTable invoices={invoices} />
      )}
    </div>
  );
}
