import { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { buildQuotationPdf } from "@/lib/quotation-pdf";
import { requirePermission } from "@/lib/session";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  await requirePermission("sales.view");
  const { id } = await params;

  const [quote, company] = await Promise.all([
    prisma.quotation.findUniqueOrThrow({
      where: { id },
      include: { customer: true, user: { select: { name: true } } },
    }),
    prisma.companyProfile.findFirst(),
  ]);

  const doc = await buildQuotationPdf(quote, company);
  const buffer = Buffer.from(doc.output("arraybuffer"));

  return new Response(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${quote.quoteNumber}.pdf"`,
    },
  });
}
