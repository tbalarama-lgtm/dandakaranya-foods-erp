import { PageHeader } from "@/components/layout/page-header";
import { RfqSourcingHub } from "@/components/procurement/rfq-sourcing-hub";
import { getRfqAnalytics, getRfqList, getRfqSourcingKpis } from "@/lib/rfq-metrics";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function RFQPage() {
  await requirePermission("purchases.view");
  const [rfqs, kpis, analytics] = await Promise.all([
    getRfqList(),
    getRfqSourcingKpis(),
    getRfqAnalytics(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="RFQ & Sourcing"
        description="Enterprise quotation comparison · vendor scoring · award workflow · reverse auction · RFQ-to-PO"
        action={{ label: "Procurement hub", href: "/procurement" }}
      />
      <RfqSourcingHub rfqs={rfqs} kpis={kpis} analytics={analytics} />
    </div>
  );
}
