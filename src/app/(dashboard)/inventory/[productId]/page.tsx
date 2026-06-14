import { notFound } from "next/navigation";
import { InventoryDetailHub } from "@/components/inventory/inventory-detail-hub";
import { getInventoryDetail } from "@/lib/inventory-metrics";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function InventoryDetailPage({ params }: { params: Promise<{ productId: string }> }) {
  await requirePermission("inventory.view");
  const { productId } = await params;
  const detail = await getInventoryDetail(productId);
  if (!detail) notFound();
  return <InventoryDetailHub detail={detail} />;
}
