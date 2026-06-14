import { PageHeader } from "@/components/layout/page-header";
import { BudgetGovernanceHub } from "@/components/procurement/budget-governance-hub";
import { getBudgetHubBundle } from "@/lib/budget-metrics";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function BudgetsPage() {
  const user = await requirePermission("purchases.view");
  const bundle = await getBudgetHubBundle();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Procurement Budget Control"
        description="Enterprise financial governance — enforcement, forecasting, variance analysis, and multi-level approvals"
        action={{ label: "Procurement hub", href: "/procurement" }}
      />
      <BudgetGovernanceHub bundle={bundle} canEdit={can(user.role, "purchases.edit")} />
    </div>
  );
}
