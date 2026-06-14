import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionMachinesClient } from "@/components/production/production-modules-client";
import { mapMachinesToLegacy } from "@/lib/production-legacy-adapters";
import { getProductionHubBundle } from "@/lib/production-metrics";

export const dynamic = "force-dynamic";

export default async function ProductionMachinesPage() {
  const bundle = await getProductionHubBundle();

  return (
    <>
      <ProductionPageHeader title="Machine & equipment monitoring" description="Live status, utilization, downtime analysis, and maintenance alerts." />
      <ProductionMachinesClient machines={mapMachinesToLegacy(bundle)} />
    </>
  );
}
