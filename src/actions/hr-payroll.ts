"use server";

import { revalidatePath } from "next/cache";
import { ActivityAction } from "@prisma/client";
import { logActivity } from "@/lib/activity";
import { isDatabaseReady } from "@/lib/db-health";
import {
  buildMockPayrollForPeriod,
  generateMonthlyPayrollInDb,
} from "@/lib/hr/payroll-service";
import { currentPayrollPeriod, formatPayrollPeriod } from "@/lib/hr/payroll-calc";
import type { PayrollRecord } from "@/lib/hr/types";
import { requirePermission } from "@/lib/session";

export type GeneratePayrollResult =
  | {
      ok: true;
      mode: "database";
      count: number;
      created: number;
      updated: number;
      month: number;
      year: number;
      periodLabel: string;
      records: PayrollRecord[];
    }
  | {
      ok: true;
      mode: "mock";
      count: number;
      month: number;
      year: number;
      periodLabel: string;
      records: PayrollRecord[];
      message: string;
    }
  | { ok: false; error: string };

export async function generateMonthlyPayroll(
  month?: number,
  year?: number,
): Promise<GeneratePayrollResult> {
  try {
    const user = await requirePermission("hr.manage");
    const period = month && year ? { month, year } : currentPayrollPeriod();
    const periodLabel = formatPayrollPeriod(period.month, period.year);

    if (!(await isDatabaseReady())) {
      const records = buildMockPayrollForPeriod(period.month, period.year);
      return {
        ok: true,
        mode: "mock",
        count: records.length,
        month: period.month,
        year: period.year,
        periodLabel,
        records,
        message: "Database not connected — payroll generated in demo mode.",
      };
    }

    const result = await generateMonthlyPayrollInDb(period.month, period.year);

    if (result.mode === "mock") {
      const needsSync = "schemaWarning" in result && result.schemaWarning;
      return {
        ok: true,
        mode: "mock",
        count: result.records.length,
        month: period.month,
        year: period.year,
        periodLabel,
        records: result.records,
        message: needsSync
          ? "Database schema is outdated. Run: npm run db:push (in admin-dashboard), then generate again. Demo payroll shown for now."
          : "No active employees in database — showing demo payroll.",
      };
    }

    await logActivity({
      userId: user.id,
      userName: user.name,
      action: ActivityAction.CREATE,
      entityType: "PayrollRun",
      message: `Generated payroll for ${periodLabel} (${result.count} employees)`,
      metadata: { month: period.month, year: period.year, created: result.created, updated: result.updated },
    }).catch(() => undefined);

    revalidatePath("/hr/payroll");
    revalidatePath("/hr");
    revalidatePath("/finance/payroll");

    return {
      ok: true,
      mode: "database",
      count: result.count,
      created: result.created,
      updated: result.updated,
      month: period.month,
      year: period.year,
      periodLabel,
      records: result.records,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to generate payroll",
    };
  }
}
