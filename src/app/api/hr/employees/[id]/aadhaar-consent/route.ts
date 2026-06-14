import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildAadhaarConsentPdf } from "@/lib/aadhaar-consent-pdf";
import { consentPdfFilename, employeeToConsentForm } from "@/lib/hr/aadhaar-consent";
import { getEmployee } from "@/lib/hr/employee-store";
import { getCompanyForPayslip } from "@/lib/hr/payslip-data";
import { can } from "@/lib/rbac";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || !can(session.user.role, "hr.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const [employee, company] = await Promise.all([getEmployee(id), getCompanyForPayslip()]);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const data = employeeToConsentForm(employee);
    const doc = await buildAadhaarConsentPdf(data, company);
    const buf = Buffer.from(doc.output("arraybuffer"));
    const filename = consentPdfFilename(employee.employeeNo);

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[aadhaar-consent-pdf]", err);
    return NextResponse.json(
      {
        error: "Failed to generate consent PDF",
        detail: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
