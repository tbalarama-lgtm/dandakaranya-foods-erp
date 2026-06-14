import type { Employee } from "@/lib/hr/types";
import { maskAadhaar } from "@/lib/hr/employee-validation";

export const AADHAAR_CONSENT_TITLE = "Aadhaar Consent & Authorization Form";

/** Primary consent statement shown in UI, print, and PDF. */
export const AADHAAR_CONSENT_STATEMENT =
  "The employee has consented to collection and use of their Aadhaar details by Dandakaranya Foods for HR, payroll, and compliance purposes as per applicable law.";

export const AADHAAR_CONSENT_PURPOSES = [
  "Employee identity verification and maintenance of personnel records",
  "Salary disbursement, statutory deductions, and payroll compliance",
  "Provident fund, ESI, and other statutory filings where Aadhaar is permitted",
  "Regulatory, audit, and lawful requests by government authorities",
] as const;

export type AadhaarConsentFormData = {
  employeeName: string;
  employeeNo: string;
  designation: string;
  department: string;
  branchName?: string;
  phone?: string;
  email?: string;
  aadhaarMasked: string;
  aadhaarLast4?: string;
  documentDate: string;
  authorizedAt?: string;
  isAuthorized: boolean;
};

export function employeeToConsentForm(employee: Employee | null): AadhaarConsentFormData {
  const today = new Date().toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  if (!employee) {
    return {
      employeeName: "",
      employeeNo: "",
      designation: "",
      department: "",
      branchName: "",
      phone: "",
      email: "",
      aadhaarMasked: "",
      documentDate: today,
      isAuthorized: false,
    };
  }

  const digits = employee.aadhaarNumber?.replace(/\s+/g, "") ?? "";
  return {
    employeeName: employee.name,
    employeeNo: employee.employeeNo,
    designation: employee.designation,
    department: employee.department,
    branchName: employee.branchName,
    phone: employee.phone,
    email: employee.email,
    aadhaarMasked: employee.aadhaarNumber ? maskAadhaar(employee.aadhaarNumber) : "",
    aadhaarLast4: digits.length >= 4 ? digits.slice(-4) : undefined,
    documentDate: today,
    authorizedAt: employee.aadhaarAuthorizedAt,
    isAuthorized: Boolean(employee.aadhaarAuthorized),
  };
}

export function consentPdfFilename(employeeNo: string) {
  const safe = employeeNo.replace(/[^a-zA-Z0-9-]/g, "_") || "employee";
  return `Aadhaar-Consent-${safe}.pdf`;
}
