import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionWorkOrdersClient } from "@/components/production/production-modules-client";
import { mapWorkOrdersToLegacy } from "@/lib/production-legacy-adapters";
import { getProductionHubBundle } from "@/lib/production-metrics";

export const dynamic = "force-dynamic";

export default async function ProductionWorkOrdersPage() {
  const bundle = await getProductionHubBundle();

  return (
    <>
      <ProductionPageHeader title="Work orders" description="Release, track, and prioritize manufacturing work orders across shifts and lines." />
      <ProductionWorkOrdersClient orders={mapWorkOrdersToLegacy(bundle)} />
    </>
  );
}
