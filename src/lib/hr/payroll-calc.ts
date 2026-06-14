import type { PayrollRecord, PayrollStatus } from "@/lib/hr/types";

/** Salary breakdown (PF 12%, ESI 0.75%, allowances 12% of basic). */
export function calculateEmployeePayroll(basicSalary: number, employeeIndex = 0) {
  const basic = Math.round(basicSalary);
  const allowances = Math.round(basic * 0.12);
  const pf = Math.round(basic * 0.12);
  const esi = Math.round(basic * 0.0075);
  const bonus = employeeIndex === 0 ? 5000 : 0;
  const otherDeduction = employeeIndex === 1 ? 500 : 0;
  const deductions = pf + esi + otherDeduction;
  const grossPay = basic + allowances + bonus;
  const netPay = grossPay - deductions;

  return { basic, allowances, pf, esi, bonus, deductions, grossPay, netPay };
}

export function buildPayrollRecord(
  input: {
    id: string;
    employeeId: string;
    employeeName: string;
    month: number;
    year: number;
    basicSalary: number;
    employeeIndex?: number;
    status?: PayrollStatus;
  },
): PayrollRecord {
  const calc = calculateEmployeePayroll(input.basicSalary, input.employeeIndex ?? 0);
  return {
    id: input.id,
    employeeId: input.employeeId,
    employeeName: input.employeeName,
    month: input.month,
    year: input.year,
    grossPay: calc.grossPay,
    allowances: calc.allowances,
    deductions: calc.deductions,
    bonus: calc.bonus,
    pf: calc.pf,
    esi: calc.esi,
    netPay: calc.netPay,
    status: input.status ?? "PROCESSED",
  };
}

export function currentPayrollPeriod() {
  const now = new Date();
  return { month: now.getMonth() + 1, year: now.getFullYear() };
}

export function formatPayrollPeriod(month: number, year: number) {
  return new Date(year, month - 1, 1).toLocaleDateString("en-IN", { month: "long", year: "numeric" });
}
