import { notFound } from "next/navigation";
import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionDetailHub } from "@/components/production/production-detail-hub";
import { getCurrentUser } from "@/lib/session";
import { can } from "@/lib/rbac";
import { getProductionBatchDetail } from "@/lib/production-metrics";

export const dynamic = "force-dynamic";

export default async function ProductionBatchDetailPage({
  params,
}: {
  params: Promise<{ batchId: string }>;
}) {
  const { batchId } = await params;
  const detail = await getProductionBatchDetail(batchId);
  if (!detail) notFound();

  const user = await getCurrentUser();
  const canEdit = user ? can(user.role, "production.manage") : false;

  return (
    <>
      <ProductionPageHeader title={detail.batchCode} description={`${detail.productName} · ${detail.recipeName}`} />
      <ProductionDetailHub detail={detail} canEdit={canEdit} />
    </>
  );
}
