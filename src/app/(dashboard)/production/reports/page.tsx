import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionReportsClient } from "@/components/production/production-modules-client";

export default function ProductionReportsPage() {
  return (
    <>
      <ProductionPageHeader title="Analytics & reports" description="Daily production, shift, machine, downtime, quality, and material consumption reports." />
      <ProductionReportsClient />
    </>
  );
}
