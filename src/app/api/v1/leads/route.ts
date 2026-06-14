import { apiHandler, jsonOk } from "@/lib/api/handler";
import { prisma } from "@/lib/db";

export const GET = apiHandler(
  async () => {
    const leads = await prisma.lead.findMany({
      take: 50,
      orderBy: { updatedAt: "desc" },
      include: {
        assignee: { select: { name: true } },
        communications: { take: 3, orderBy: { sentAt: "desc" } },
      },
    });
    const pipeline = await prisma.lead.groupBy({ by: ["stage"], _count: { _all: true } });
    return jsonOk({ leads, pipeline });
  },
  { permission: "leads.view" },
);
