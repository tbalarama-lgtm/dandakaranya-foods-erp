import { PageHeader } from "@/components/layout/page-header";
import { PayablesPlatform } from "@/components/procurement/payables-platform";
import { getAllPayables } from "@/lib/procurement-metrics";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function PayablesPage() {
  await requirePermission("purchases.view");
  const { payables, aging } = await getAllPayables();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payables & vendor balances"
        description="Aging analysis · due dates · outstanding balances · payment tracking"
        action={{ label: "Procurement hub", href: "/procurement" }}
      />
      <PayablesPlatform payables={payables} aging={aging} />
    </div>
  );
}
