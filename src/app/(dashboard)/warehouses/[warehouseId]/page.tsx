import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { WarehouseDetailHub } from "@/components/warehouse/warehouse-detail-hub";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getWarehouseDetail } from "@/lib/warehouse-metrics";

export const dynamic = "force-dynamic";

export default async function WarehouseDetailPage({
  params,
}: {
  params: Promise<{ warehouseId: string }>;
}) {
  const { warehouseId } = await params;
  const detail = await getWarehouseDetail(warehouseId);
  if (!detail) notFound();

  const user = await getCurrentUser();
  const canEdit = user ? can(user.role, "inventory.edit") : false;

  return (
    <div>
      <PageHeader title={detail.name} description={`${detail.code} · ${detail.branchName ?? "Unassigned branch"} · ${detail.city ?? detail.address ?? "—"}`} />
      <WarehouseDetailHub detail={detail} canEdit={canEdit} />
    </div>
  );
}
