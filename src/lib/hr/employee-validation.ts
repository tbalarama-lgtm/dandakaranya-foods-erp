import type { Employee } from "@/lib/hr/types";

export function normalizeAadhaar(value: string) {
  return value.replace(/\s+/g, "").trim();
}

export function normalizeIfsc(value: string) {
  return value.trim().toUpperCase();
}

export function maskAadhaar(value?: string | null) {
  if (!value) return "—";
  const digits = normalizeAadhaar(value);
  if (digits.length < 4) return "—";
  return `XXXX XXXX ${digits.slice(-4)}`;
}

export function maskBankAccount(value?: string | null) {
  if (!value) return "—";
  const digits = value.replace(/\s+/g, "");
  if (digits.length < 4) return "—";
  return `•••• ${digits.slice(-4)}`;
}

export function validateEmployeeCompliance(
  data: Pick<
    Employee,
    | "bankAccountName"
    | "bankName"
    | "bankAccountNumber"
    | "bankIfsc"
    | "aadhaarNumber"
    | "aadhaarAuthorized"
  >,
): string | null {
  const bankFields = [
    data.bankAccountName,
    data.bankName,
    data.bankAccountNumber,
    data.bankIfsc,
  ];
  const anyBank = bankFields.some((v) => Boolean(v?.trim()));
  const allBank =
    data.bankAccountName?.trim() &&
    data.bankName?.trim() &&
    data.bankAccountNumber?.trim() &&
    data.bankIfsc?.trim();

  if (anyBank && !allBank) {
    return "Complete all required bank fields: account name, bank name, account number, and IFSC";
  }

  if (data.bankAccountNumber?.trim()) {
    const acct = data.bankAccountNumber.replace(/\s+/g, "");
    if (!/^\d{9,18}$/.test(acct)) {
      return "Bank account number must be 9–18 digits";
    }
  }

  if (data.bankIfsc?.trim() && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(normalizeIfsc(data.bankIfsc))) {
    return "IFSC code must be 11 characters (e.g. SBIN0001234)";
  }

  const aadhaar = data.aadhaarNumber ? normalizeAadhaar(data.aadhaarNumber) : "";
  if (aadhaar && !/^\d{12}$/.test(aadhaar)) {
    return "Aadhaar number must be exactly 12 digits";
  }

  if (data.aadhaarAuthorized && !aadhaar) {
    return "Enter the Aadhaar number before recording authorization";
  }

  if (aadhaar && !data.aadhaarAuthorized) {
    return "Check Aadhaar authorization to confirm employee consent for HR/payroll use";
  }

  return null;
}
