import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { BranchDetailHub } from "@/components/warehouse/branch-detail-hub";
import { getBranchDetail } from "@/lib/warehouse-metrics";

export const dynamic = "force-dynamic";

export default async function BranchDetailPage({
  params,
}: {
  params: Promise<{ branchId: string }>;
}) {
  const { branchId } = await params;
  const detail = await getBranchDetail(branchId);
  if (!detail) notFound();

  return (
    <div>
      <PageHeader title={detail.name} description={`Branch ${detail.code} · ${detail.region ?? detail.state ?? "—"}`} />
      <BranchDetailHub detail={detail} />
    </div>
  );
}
