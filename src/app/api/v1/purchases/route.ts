import { apiHandler, jsonOk } from "@/lib/api/handler";
import { prisma } from "@/lib/db";

export const GET = apiHandler(
  async () => {
    const purchases = await prisma.purchase.findMany({
      take: 50,
      orderBy: { purchaseDate: "desc" },
      include: { vendor: { select: { name: true } } },
    });
    return jsonOk({ purchases });
  },
  { permission: "purchases.view" },
);
