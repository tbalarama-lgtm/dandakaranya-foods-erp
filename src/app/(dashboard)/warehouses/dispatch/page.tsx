import { PageHeader } from "@/components/layout/page-header";
import { DispatchOpsHub } from "@/components/warehouse/dispatch-ops-hub";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getWarehouseHubBundle } from "@/lib/warehouse-metrics";

export const dynamic = "force-dynamic";

export default async function WarehouseDispatchPage() {
  const user = await getCurrentUser();
  const bundle = await getWarehouseHubBundle();
  const canEdit = user ? can(user.role, "inventory.edit") : false;

  return (
    <div>
      <PageHeader
        title="Pick · pack · dispatch"
        description="Dispatch workflows, transporter tracking, LR management, and dock logistics."
      />
      <DispatchOpsHub dispatches={bundle.dispatches} canEdit={canEdit} />
    </div>
  );
}
