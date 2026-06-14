import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { InvoicePlatform } from "@/components/sales/invoice-platform";
import {
  getInvoiceAnalytics,
  getInvoices,
  notifyOverdueInvoices,
  syncInvoiceOverdue,
  syncLegacyInvoiceStatusField,
} from "@/lib/invoice-metrics";
import { requirePermission } from "@/lib/session";
import type { InvoiceStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function SalesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; overdue?: string }>;
}) {
  await requirePermission("sales.view");
  const sp = await searchParams;

  void syncLegacyInvoiceStatusField().catch(() => {});
  void syncInvoiceOverdue().catch(() => {});
  void notifyOverdueInvoices().catch(() => {});

  const [invoices, analytics] = await Promise.all([
    getInvoices({
      q: sp.q,
      status: sp.status as InvoiceStatus | undefined,
      overdue: sp.overdue === "1",
    }),
    getInvoiceAnalytics(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales & Billing"
        description="Tax invoices · GST compliance · payments · receivables · credit notes"
      />
      <Suspense fallback={null}>
        <InvoicePlatform invoices={invoices} analytics={analytics} />
      </Suspense>
    </div>
  );
}
