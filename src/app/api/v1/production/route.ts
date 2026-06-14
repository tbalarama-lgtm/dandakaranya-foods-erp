import { apiHandler, jsonOk } from "@/lib/api/handler";
import { prisma } from "@/lib/db";

export const GET = apiHandler(
  async () => {
    const [batches, recipes, logs] = await Promise.all([
      prisma.productionBatch.findMany({
        take: 30,
        orderBy: { createdAt: "desc" },
        include: { recipe: { include: { outputProduct: { select: { name: true } } } } },
      }),
      prisma.recipe.findMany({ include: { outputProduct: { select: { name: true } } } }),
      prisma.productionLog.findMany({ take: 20, orderBy: { logDate: "desc" } }),
    ]);
    return jsonOk({ batches, recipes, logs });
  },
  { permission: "production.view" },
);
