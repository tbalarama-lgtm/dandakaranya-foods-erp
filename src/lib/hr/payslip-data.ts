import type { CompanyProfile } from "@prisma/client";
import { prisma } from "@/lib/db";
import { MOCK_EMPLOYEES, MOCK_PAYROLL } from "@/lib/hr/mock-data";
import type { PayrollRecord } from "@/lib/hr/types";
import { toNumber } from "@/lib/utils";

export type PayslipLine = { label: string; amount: number };

export type PayslipData = {
  payrollId: string;
  payslipNo: string;
  periodLabel: string;
  employee: {
    name: string;
    employeeNo: string;
    department: string;
    designation: string;
    email?: string;
    phone?: string;
    branchName?: string;
    joinedAt?: string;
  };
  earnings: PayslipLine[];
  deductions: PayslipLine[];
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  status: string;
};

function monthLabel(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}

function payslipNo(record: Pick<PayrollRecord, "employeeId" | "month" | "year">) {
  return `PS-${record.year}${String(record.month).padStart(2, "0")}-${record.employeeId.slice(-6).toUpperCase()}`;
}

function fromMockRecord(record: PayrollRecord): PayslipData {
  const employee = MOCK_EMPLOYEES.find((e) => e.id === record.employeeId);
  const otherDeductions = Math.max(0, record.deductions - record.pf - record.esi);
  const basic = Math.max(0, record.grossPay - record.allowances - record.bonus);

  const earnings: PayslipLine[] = [
    { label: "Basic salary", amount: basic },
    { label: "Allowances (HRA & others)", amount: record.allowances },
  ];
  if (record.bonus > 0) earnings.push({ label: "Bonus / incentives", amount: record.bonus });

  const deductions: PayslipLine[] = [
    { label: "Provident fund (PF)", amount: record.pf },
    { label: "ESI", amount: record.esi },
  ];
  if (otherDeductions > 0) deductions.push({ label: "Other deductions", amount: otherDeductions });

  return {
    payrollId: record.id,
    payslipNo: payslipNo(record),
    periodLabel: monthLabel(record.month, record.year),
    employee: {
      name: record.employeeName,
      employeeNo: employee?.employeeNo ?? record.employeeId,
      department: employee?.department ?? "—",
      designation: employee?.designation ?? "—",
      email: employee?.email,
      phone: employee?.phone,
      branchName: employee?.branchName,
      joinedAt: employee?.joinedAt,
    },
    earnings,
    deductions,
    grossPay: record.grossPay,
    totalDeductions: record.deductions,
    netPay: record.netPay,
    status: record.status,
  };
}

async function fromPrismaPayroll(
  row: {
    id: string;
    month: number;
    year: number;
    grossPay: unknown;
    deductions: unknown;
    netPay: unknown;
    employee: {
      id: string;
      employeeNo: string;
      name: string;
      email: string | null;
      phone: string | null;
      department: string | null;
      designation: string | null;
      salary: unknown;
      joinedAt: Date;
      branch?: { name: string } | null;
    };
  },
): Promise<PayslipData> {
  const gross = toNumber(row.grossPay);
  const deductions = toNumber(row.deductions);
  const net = toNumber(row.netPay);
  const basic = toNumber(row.employee.salary);
  const allowances = Math.max(0, gross - basic);

  const earnings: PayslipLine[] = [{ label: "Basic salary", amount: basic }];
  if (allowances > 0) earnings.push({ label: "Allowances", amount: allowances });

  const pf = Math.round(basic * 0.12);
  const esi = Math.round(basic * 0.0075);
  const other = Math.max(0, deductions - pf - esi);

  const deductionLines: PayslipLine[] = [
    { label: "Provident fund (PF)", amount: pf },
    { label: "ESI", amount: esi },
  ];
  if (other > 0) deductionLines.push({ label: "Other deductions", amount: other });

  return {
    payrollId: row.id,
    payslipNo: payslipNo({ employeeId: row.employee.id, month: row.month, year: row.year }),
    periodLabel: monthLabel(row.month, row.year),
    employee: {
      name: row.employee.name,
      employeeNo: row.employee.employeeNo,
      department: row.employee.department ?? "—",
      designation: row.employee.designation ?? "—",
      email: row.employee.email ?? undefined,
      phone: row.employee.phone ?? undefined,
      branchName: row.employee.branch?.name,
      joinedAt: row.employee.joinedAt.toISOString().slice(0, 10),
    },
    earnings,
    deductions: deductionLines,
    grossPay: gross,
    totalDeductions: deductions,
    netPay: net,
    status: row.netPay ? "PROCESSED" : "DRAFT",
  };
}

export async function getPayslipData(payrollId: string): Promise<PayslipData | null> {
  try {
    const row = await prisma.payrollRun.findUnique({
      where: { id: payrollId },
      include: { employee: { include: { branch: true } } },
    });
    if (row) return fromPrismaPayroll(row);
  } catch {
    /* database unavailable — fall through to mock */
  }

  const mock = MOCK_PAYROLL.find((r) => r.id === payrollId);
  if (mock) return fromMockRecord(mock);

  return null;
}

export async function getCompanyForPayslip(): Promise<CompanyProfile | null> {
  try {
    return await prisma.companyProfile.findUnique({ where: { id: 1 } });
  } catch {
    return null;
  }
}
