import { PageHeader } from "@/components/layout/page-header";
import { LogisticsPlatform } from "@/components/logistics/logistics-platform";
import { getLogisticsHubAnalytics } from "@/lib/logistics-metrics";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function LogisticsPage() {
  await requirePermission("inventory.view");
  const analytics = await getLogisticsHubAnalytics();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Logistics & Dispatch"
        description="Warehouse network · pick-pack-dispatch · inter-branch transfers · dock scheduling for Sukma & Bastar operations"
      />
      <LogisticsPlatform analytics={analytics} />
    </div>
  );
}
