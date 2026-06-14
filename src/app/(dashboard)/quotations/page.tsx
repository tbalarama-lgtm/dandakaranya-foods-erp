import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { QuotationPlatform } from "@/components/quotations/quotation-platform";
import { getQuotationAnalytics, getQuotations, notifyQuotationExpiryReminders, syncQuotationExpiry } from "@/lib/quotation-metrics";
import { requirePermission } from "@/lib/session";
import type { QuotationStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; expiring?: string }>;
}) {
  await requirePermission("sales.view");
  const sp = await searchParams;

  void syncQuotationExpiry().catch(() => {});
  void notifyQuotationExpiryReminders().catch(() => {});

  const [quotations, analytics] = await Promise.all([
    getQuotations({
      q: sp.q,
      status: sp.status as QuotationStatus | undefined,
      expiring: sp.expiring === "1",
    }),
    getQuotationAnalytics(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations & Proposals"
        description="Commercial quotes · GST & export pricing · approvals · PDF proposals"
      />
      <Suspense fallback={null}>
        <QuotationPlatform quotations={quotations} analytics={analytics} />
      </Suspense>
    </div>
  );
}
