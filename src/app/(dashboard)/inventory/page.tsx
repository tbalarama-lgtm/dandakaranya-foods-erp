import { PageHeader } from "@/components/layout/page-header";
import { InventoryGovernanceHub } from "@/components/inventory/inventory-governance-hub";
import { getInventoryHubBundle } from "@/lib/inventory-metrics";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
  await requirePermission("inventory.view");
  const bundle = await getInventoryHubBundle();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory & Warehouse"
        description="Enterprise stock intelligence — batch traceability, FEFO, reservations, transfers, and food-manufacturing inventory"
      />
      <InventoryGovernanceHub bundle={bundle} />
    </div>
  );
}
