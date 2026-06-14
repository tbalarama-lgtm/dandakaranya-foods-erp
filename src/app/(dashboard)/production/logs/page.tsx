import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionLogsClient, mapLogsFromPrisma } from "@/components/production/production-legacy-client";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/safe-prisma";

export const dynamic = "force-dynamic";

export default async function ProductionLogsPage() {
  const logs = await safeQuery(
    () =>
      prisma.productionLog.findMany({
        take: 50,
        orderBy: { logDate: "desc" },
        include: { batch: { select: { batchCode: true } } },
      }),
    [],
  );

  return (
    <>
      <ProductionPageHeader title="Production logs" description="Daily output quantities per shift and batch — linked to manufacturing batches." />
      <ProductionLogsClient logs={mapLogsFromPrisma(logs)} />
    </>
  );
}
