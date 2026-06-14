import { PageHeader } from "@/components/layout/page-header";
import { PoExecutionHub } from "@/components/purchases/po-execution-hub";
import { SchemaMigrationBanner } from "@/components/setup/schema-migration-banner";
import { isPoExecutionDbSchemaReady } from "@/lib/db-health";
import { getPoExecutionKpis, getPoList } from "@/lib/po-metrics";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function PurchasesPage() {
  const user = await requirePermission("purchases.view");
  const schemaReady = await isPoExecutionDbSchemaReady();
  const [orders, kpis] = await Promise.all([getPoList(), getPoExecutionKpis()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Purchase Orders"
        description="Enterprise PO execution — RFQ → PO → GRN → QC → Stock → Bill → Payment"
        action={
          can(user.role, "purchases.create")
            ? { label: "New PO", href: "/purchases/new" }
            : undefined
        }
      />
      {!schemaReady ? <SchemaMigrationBanner module="Purchase Orders" /> : null}
      <PoExecutionHub orders={orders} kpis={kpis} canCreate={can(user.role, "purchases.create")} />
    </div>
  );
}
