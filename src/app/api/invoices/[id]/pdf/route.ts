import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildInvoicePdf } from "@/lib/invoice-pdf";
import { serializeInvoiceForPdf } from "@/lib/serialize-invoice";
import { can } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || !can(session.user.role, "sales.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const [invoice, company] = await Promise.all([
      prisma.saleInvoice.findUnique({
        where: { id },
        include: { customer: true, items: { include: { product: true } } },
      }),
      prisma.companyProfile.findUnique({ where: { id: 1 } }),
    ]);
    if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const doc = await buildInvoicePdf(serializeInvoiceForPdf(invoice), company);
    const buf = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${invoice.invoiceNumber}.pdf"`,
      },
    });
  } catch (err) {
    console.error("[invoice-pdf]", err);
    return NextResponse.json(
      { error: "Failed to generate invoice PDF", detail: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
