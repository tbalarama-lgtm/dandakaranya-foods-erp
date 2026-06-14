import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionMaterialsClient } from "@/components/production/production-modules-client";
import { mapMaterialsToLegacy } from "@/lib/production-legacy-adapters";
import { getProductionHubBundle } from "@/lib/production-metrics";

export const dynamic = "force-dynamic";

export default async function ProductionMaterialsPage() {
  const bundle = await getProductionHubBundle();

  return (
    <>
      <ProductionPageHeader title="Raw materials & MRP" description="Stock levels, consumption, shortages, and warehouse-linked material planning." />
      <ProductionMaterialsClient materials={mapMaterialsToLegacy(bundle)} />
    </>
  );
}
