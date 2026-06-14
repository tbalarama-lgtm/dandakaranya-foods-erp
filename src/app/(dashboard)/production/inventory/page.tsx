import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionInventoryClient } from "@/components/production/production-modules-client";

export default function ProductionInventoryPage() {
  return (
    <>
      <ProductionPageHeader title="Inventory integration" description="Finished goods, packaging materials, warehouse transfers, and dispatch readiness." />
      <ProductionInventoryClient />
    </>
  );
}
