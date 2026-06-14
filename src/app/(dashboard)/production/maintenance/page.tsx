import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionMaintenanceClient } from "@/components/production/production-modules-client";

export default function ProductionMaintenancePage() {
  return (
    <>
      <ProductionPageHeader title="Maintenance management" description="Preventive and breakdown maintenance, service scheduling, and spare parts." />
      <ProductionMaintenanceClient />
    </>
  );
}
