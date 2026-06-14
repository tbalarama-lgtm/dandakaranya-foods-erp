import { notFound } from "next/navigation";
import { BudgetDetailHub } from "@/components/procurement/budget-detail-hub";
import { getBudgetDetail } from "@/lib/budget-metrics";
import { requirePermission } from "@/lib/session";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export default async function BudgetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission("purchases.view");
  const { id } = await params;
  const detail = await getBudgetDetail(id);
  if (!detail) notFound();

  return <BudgetDetailHub detail={detail} canEdit={can(user.role, "purchases.edit")} />;
}
