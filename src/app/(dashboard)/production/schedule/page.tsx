import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionScheduleHub } from "@/components/production/production-schedule-hub";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getProductionHubBundle } from "@/lib/production-metrics";

export const dynamic = "force-dynamic";

export default async function ProductionSchedulePage() {
  const user = await getCurrentUser();
  const bundle = await getProductionHubBundle();
  const canEdit = user ? can(user.role, "production.manage") : false;

  return (
    <>
      <ProductionPageHeader
        title="Production scheduling"
        description="Gantt-based scheduling with drag-and-drop, machine allocation, and shift planning."
      />
      <ProductionScheduleHub
        slots={bundle.ganttSlots}
        machines={bundle.machines.map((m) => ({ id: m.id, name: m.name }))}
        canEdit={canEdit}
      />
    </>
  );
}
