import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionQualityClient } from "@/components/production/production-modules-client";
import { mapQcToLegacy } from "@/lib/production-legacy-adapters";
import { getProductionHubBundle } from "@/lib/production-metrics";

export const dynamic = "force-dynamic";

export default async function ProductionQualityPage() {
  const bundle = await getProductionHubBundle();

  return (
    <>
      <ProductionPageHeader title="Quality control" description="Batch inspections, FSSAI/HACCP compliance, and QC hold management." />
      <ProductionQualityClient inspections={mapQcToLegacy(bundle)} />
    </>
  );
}
