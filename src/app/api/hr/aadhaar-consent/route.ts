import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { buildAadhaarConsentPdf } from "@/lib/aadhaar-consent-pdf";
import { employeeToConsentForm } from "@/lib/hr/aadhaar-consent";
import { getCompanyForPayslip } from "@/lib/hr/payslip-data";
import { can } from "@/lib/rbac";

export const runtime = "nodejs";

/** Blank consent form PDF (no employee pre-filled). */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || !can(session.user.role, "hr.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const company = await getCompanyForPayslip();
    const data = employeeToConsentForm(null);
    const doc = await buildAadhaarConsentPdf(data, company);
    const buf = Buffer.from(doc.output("arraybuffer"));

    return new NextResponse(buf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": 'attachment; filename="Aadhaar-Consent-Blank.pdf"',
      },
    });
  } catch (err) {
    console.error("[aadhaar-consent-blank-pdf]", err);
    return NextResponse.json(
      {
        error: "Failed to generate consent PDF",
        detail: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
