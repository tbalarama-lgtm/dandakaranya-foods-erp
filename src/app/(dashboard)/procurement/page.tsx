import { PageHeader } from "@/components/layout/page-header";
import { ProcurementPlatform } from "@/components/procurement/procurement-platform";
import { getProcurementHubAnalytics } from "@/lib/procurement-metrics";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ProcurementPage() {
  await requirePermission("purchases.view");
  const analytics = await getProcurementHubAnalytics();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement Operations Hub"
        description="Enterprise supplier intelligence · lifecycle sync · GRN · QC · approvals · payables · food industry procurement"
      />
      <ProcurementPlatform analytics={analytics} />
    </div>
  );
}
