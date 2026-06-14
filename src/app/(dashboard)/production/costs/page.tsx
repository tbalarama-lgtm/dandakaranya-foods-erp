import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionCostsClient, mapBatchesFromPrisma } from "@/components/production/production-legacy-client";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/safe-prisma";

export const dynamic = "force-dynamic";

export default async function ProductionCostsPage() {
  const batches = await safeQuery(
    () =>
      prisma.productionBatch.findMany({
        take: 50,
        orderBy: { createdAt: "desc" },
        include: { recipe: { include: { outputProduct: { select: { name: true } } } } },
      }),
    [],
  );

  return (
    <>
      <ProductionPageHeader title="Cost tracking" description="Material and labor cost per batch with total production spend." />
      <ProductionCostsClient batches={mapBatchesFromPrisma(batches)} />
    </>
  );
}
