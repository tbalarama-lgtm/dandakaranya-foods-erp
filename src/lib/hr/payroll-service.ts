import type { PayrollRun, Employee } from "@prisma/client";
import { prisma } from "@/lib/db";
import { isDatabaseReady } from "@/lib/db-health";
import { MOCK_EMPLOYEES, MOCK_PAYROLL } from "@/lib/hr/mock-data";
import type { PayrollRecord } from "@/lib/hr/types";
import {
  buildPayrollRecord,
  calculateEmployeePayroll,
  currentPayrollPeriod,
  formatPayrollPeriod,
} from "@/lib/hr/payroll-calc";
import { toNumber } from "@/lib/utils";

function mapRunToRecord(
  run: PayrollRun & { employee: Employee },
  index: number,
): PayrollRecord {
  const basic = toNumber(run.employee.salary);
  const calc = calculateEmployeePayroll(basic, index);
  const storedGross = toNumber(run.grossPay);
  const storedDeductions = toNumber(run.deductions);
  const storedNet = toNumber(run.netPay);

  return {
    id: run.id,
    employeeId: run.employeeId,
    employeeName: run.employee.name,
    month: run.month,
    year: run.year,
    grossPay: storedGross,
    allowances: calc.allowances,
    deductions: storedDeductions,
    bonus: calc.bonus,
    pf: calc.pf,
    esi: calc.esi,
    netPay: storedNet,
    status: run.paidAt ? "PAID" : "PROCESSED",
  };
}

export async function getPayrollRecords(month?: number, year?: number): Promise<{
  records: PayrollRecord[];
  period: { month: number; year: number; label: string };
  source: "database" | "mock";
}> {
  const period = month && year ? { month, year } : currentPayrollPeriod();
  const label = formatPayrollPeriod(period.month, period.year);

  if (!(await isDatabaseReady())) {
    return { records: MOCK_PAYROLL, period: { ...period, label }, source: "mock" };
  }

  try {
    let runs = await prisma.payrollRun.findMany({
      where: { month: period.month, year: period.year },
      include: { employee: true },
      orderBy: { employee: { name: "asc" } },
    });

    if (runs.length === 0) {
      runs = await prisma.payrollRun.findMany({
        include: { employee: true },
        orderBy: [{ year: "desc" }, { month: "desc" }, { createdAt: "desc" }],
        take: 50,
      });
    }

    if (runs.length > 0) {
      return {
        records: runs.map((r, i) => mapRunToRecord(r, i)),
        period: {
          month: runs[0].month,
          year: runs[0].year,
          label: formatPayrollPeriod(runs[0].month, runs[0].year),
        },
        source: "database",
      };
    }
  } catch {
    /* fall through to mock */
  }

  return { records: MOCK_PAYROLL, period: { ...period, label }, source: "mock" };
}

export function buildMockPayrollForPeriod(month: number, year: number): PayrollRecord[] {
  return MOCK_EMPLOYEES.filter((e) => e.status === "ACTIVE").map((e, i) =>
    buildPayrollRecord({
      id: `pay-${e.id}-${year}-${month}`,
      employeeId: e.id,
      employeeName: e.name,
      month,
      year,
      basicSalary: e.salary,
      employeeIndex: i,
      status: i < 4 ? "PAID" : "PROCESSED",
    }),
  );
}

function isSchemaMismatchError(err: unknown) {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("does not exist") || msg.includes("P2021") || msg.includes("P2022");
}

export async function generateMonthlyPayrollInDb(month: number, year: number) {
  let employees: Employee[];
  try {
    employees = await prisma.employee.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    });
  } catch (err) {
    if (isSchemaMismatchError(err)) {
      console.error("[payroll] Database schema out of date. Run: npm run db:push", err);
      const records = buildMockPayrollForPeriod(month, year);
      return {
        mode: "mock" as const,
        count: records.length,
        records,
        schemaWarning: true,
      };
    }
    throw err;
  }

  if (employees.length === 0) {
    const records = buildMockPayrollForPeriod(month, year);
    return {
      mode: "mock" as const,
      count: records.length,
      records,
    };
  }

  let created = 0;
  let updated = 0;

  for (let i = 0; i < employees.length; i++) {
    const emp = employees[i];
    const { grossPay, deductions, netPay } = calculateEmployeePayroll(toNumber(emp.salary), i);

    const existing = await prisma.payrollRun.findUnique({
      where: {
        employeeId_month_year: { employeeId: emp.id, month, year },
      },
    });

    await prisma.payrollRun.upsert({
      where: {
        employeeId_month_year: { employeeId: emp.id, month, year },
      },
      create: {
        employeeId: emp.id,
        month,
        year,
        grossPay,
        deductions,
        netPay,
      },
      update: {
        grossPay,
        deductions,
        netPay,
        paidAt: null,
      },
    });

    if (existing) updated++;
    else created++;
  }

  const runs = await prisma.payrollRun.findMany({
    where: { month, year },
    include: { employee: true },
    orderBy: { employee: { name: "asc" } },
  });

  return {
    mode: "database" as const,
    count: employees.length,
    created,
    updated,
    records: runs.map((r, i) => mapRunToRecord(r, i)),
  };
}
