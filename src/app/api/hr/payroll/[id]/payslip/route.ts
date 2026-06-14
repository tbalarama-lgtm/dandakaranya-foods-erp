import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { getCompanyForPayslip, getPayslipData } from "@/lib/hr/payslip-data";
import { buildPayslipPdf } from "@/lib/payslip-pdf";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || !can(session.user.role, "hr.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const [data, company] = await Promise.all([getPayslipData(id), getCompanyForPayslip()]);
    if (!data) return NextResponse.json({ error: "Payroll record not found" }, { status: 404 });

    const doc = await buildPayslipPdf(data, company);
    const buf = Buffer.from(doc.output("arraybuffer"));
    const filename = `${data.payslipNo}.pdf`;

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[payslip-pdf]", err);
    return NextResponse.json(
      {
        error: "Failed to generate payslip PDF",
        detail: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
