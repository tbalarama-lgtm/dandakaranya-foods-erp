import { notFound } from "next/navigation";
import { AadhaarConsentDocument } from "@/components/hr/aadhaar-consent-document";
import { HrPageHeader } from "@/components/hr/hr-page-header";
import { employeeToConsentForm } from "@/lib/hr/aadhaar-consent";
import { getEmployee } from "@/lib/hr/employee-store";
import { getCompanyForPayslip } from "@/lib/hr/payslip-data";

export default async function EmployeeAadhaarConsentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [employee, company] = await Promise.all([getEmployee(id), getCompanyForPayslip()]);
  if (!employee) notFound();

  const data = employeeToConsentForm(employee);
  const companyName = company?.legalName || company?.name || "Dandakaranya Foods";
  const companyContact = [company?.phone, company?.email].filter(Boolean).join(" · ");

  return (
    <>
      <HrPageHeader
        className="print-hidden"
        title="Aadhaar consent form"
        description={`Printable authorization for ${employee.name}`}
      />
      <AadhaarConsentDocument
        data={data}
        employeeId={employee.id}
        backHref={`/hr/employees/${employee.id}`}
        companyName={companyName}
        companyAddress={company?.address ?? undefined}
        companyContact={companyContact || undefined}
      />
    </>
  );
}
