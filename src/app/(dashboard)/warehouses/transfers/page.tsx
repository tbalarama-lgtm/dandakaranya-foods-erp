import { PageHeader } from "@/components/layout/page-header";
import { TransferOpsHub } from "@/components/warehouse/transfer-ops-hub";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getWarehouseHubBundle } from "@/lib/warehouse-metrics";

export const dynamic = "force-dynamic";

export default async function WarehouseTransfersPage() {
  const user = await getCurrentUser();
  const bundle = await getWarehouseHubBundle();
  const canEdit = user ? can(user.role, "inventory.edit") : false;

  return (
    <div>
      <PageHeader
        title="Inter-warehouse transfers"
        description="Transfer requests, approvals, shipment tracking, and receiving confirmation."
      />
      <TransferOpsHub transfers={bundle.transfers} canEdit={canEdit} />
    </div>
  );
}
