import { apiHandler, jsonOk } from "@/lib/api/handler";
import { prisma } from "@/lib/db";

export const GET = apiHandler(
  async () => {
    const [orders, invoices] = await Promise.all([
      prisma.salesOrder.findMany({
        take: 50,
        orderBy: { orderDate: "desc" },
        include: { customer: { select: { name: true } } },
      }),
      prisma.saleInvoice.findMany({
        take: 50,
        orderBy: { invoiceDate: "desc" },
        include: { customer: { select: { name: true } } },
      }),
    ]);
    return jsonOk({ orders, invoices });
  },
  { permission: "sales.view" },
);
