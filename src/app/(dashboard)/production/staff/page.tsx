import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionStaffClient } from "@/components/production/production-modules-client";

export default function ProductionStaffPage() {
  return (
    <>
      <ProductionPageHeader title="Production staff" description="Shift management, worker allocation, attendance, and productivity tracking." />
      <ProductionStaffClient />
    </>
  );
}
