import { ProductionPageHeader } from "@/components/production/production-page-header";
import { ProductionRecipesClient, mapRecipesFromPrisma } from "@/components/production/production-legacy-client";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/safe-prisma";

export const dynamic = "force-dynamic";

export default async function ProductionRecipesPage() {
  const recipes = await safeQuery(
    () =>
      prisma.recipe.findMany({
        include: { outputProduct: { select: { name: true } } },
        orderBy: { name: "asc" },
      }),
    [],
  );

  return (
    <>
      <ProductionPageHeader title="Recipes & formulation" description="Bill of materials, yield per finished good, and active recipe management." />
      <ProductionRecipesClient recipes={mapRecipesFromPrisma(recipes)} />
    </>
  );
}
