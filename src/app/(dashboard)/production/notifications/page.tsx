import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionNotificationsClient } from "@/components/production/production-modules-client";
import { mapNotificationsToLegacy } from "@/lib/production-legacy-adapters";
import { getProductionHubBundle } from "@/lib/production-metrics";

export const dynamic = "force-dynamic";

export default async function ProductionNotificationsPage() {
  const bundle = await getProductionHubBundle();

  return (
    <>
      <ProductionPageHeader title="Production alerts" description="Material shortages, downtime, delays, QC failures, and bottleneck notifications." />
      <ProductionNotificationsClient items={mapNotificationsToLegacy(bundle)} />
    </>
  );
}
