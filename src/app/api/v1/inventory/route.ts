import { apiHandler, jsonOk } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";

export const GET = apiHandler(
  async () => {
    const products = await prisma.product.findMany({
      include: { warehouse: true, category: true, batches: true },
      orderBy: { name: "asc" },
    });
    const lowStock = products.filter((p) => toNumber(p.stockQty) <= toNumber(p.minStockQty));
    return jsonOk({ products, lowStock, warehouses: await prisma.warehouse.findMany() });
  },
  { permission: "inventory.view" },
);
