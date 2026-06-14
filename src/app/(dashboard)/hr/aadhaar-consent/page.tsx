import { AadhaarConsentDocument } from "@/components/hr/aadhaar-consent-document";
import { HrPageHeader } from "@/components/hr/hr-page-header";
import { employeeToConsentForm } from "@/lib/hr/aadhaar-consent";
import { getCompanyForPayslip } from "@/lib/hr/payslip-data";

export default async function BlankAadhaarConsentPage() {
  const company = await getCompanyForPayslip();
  const data = employeeToConsentForm(null);
  const companyName = company?.legalName || company?.name || "Dandakaranya Foods";
  const companyContact = [company?.phone, company?.email].filter(Boolean).join(" · ");

  return (
    <>
      <HrPageHeader
        className="print-hidden"
        title="Aadhaar consent form"
        description="Blank printable form — fill in employee details and obtain signatures"
      />
      <AadhaarConsentDocument
        data={data}
        backHref="/hr/employees"
        companyName={companyName}
        companyAddress={company?.address ?? undefined}
        companyContact={companyContact || undefined}
      />
    </>
  );
}
