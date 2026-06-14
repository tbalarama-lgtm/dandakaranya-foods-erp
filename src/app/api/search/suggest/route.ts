import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ results: [] });

  const [invoices, leads, products] = await Promise.all([
    prisma.saleInvoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { contains: q, mode: "insensitive" } },
          { customer: { name: { contains: q, mode: "insensitive" } } },
        ],
      },
      include: { customer: { select: { name: true } } },
      take: 4,
    }),
    prisma.lead.findMany({
      where: {
        OR: [
          { company: { contains: q, mode: "insensitive" } },
          { contactName: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
    }),
    prisma.product.findMany({
      where: {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
        ],
      },
      take: 4,
    }),
  ]);

  const results = [
    ...invoices.map((i) => ({
      type: "invoice" as const,
      id: i.id,
      label: i.invoiceNumber,
      sub: i.customer.name,
      href: `/sales`,
    })),
    ...leads.map((l) => ({
      type: "lead" as const,
      id: l.id,
      label: l.company,
      sub: l.contactName,
      href: `/leads`,
    })),
    ...products.map((p) => ({
      type: "product" as const,
      id: p.id,
      label: p.name,
      sub: p.sku,
      href: `/products`,
    })),
  ].slice(0, 8);

  return NextResponse.json({ results });
}
