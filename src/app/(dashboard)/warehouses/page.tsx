import { PageHeader } from "@/components/layout/page-header";
import { WarehouseGovernanceHub } from "@/components/warehouse/warehouse-governance-hub";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getWarehouseHubBundle } from "@/lib/warehouse-metrics";

export const dynamic = "force-dynamic";

export default async function WarehousesPage() {
  const user = await getCurrentUser();
  const bundle = await getWarehouseHubBundle();
  const canEdit = user ? can(user.role, "inventory.edit") : false;

  return (
    <div>
      <PageHeader
        title="Warehouse & Distribution"
        description="Enterprise WMS — branches, warehouses, distribution centers, transfers, dispatch, and network analytics."
      />
      <WarehouseGovernanceHub bundle={bundle} canEdit={canEdit} />
    </div>
  );
}
