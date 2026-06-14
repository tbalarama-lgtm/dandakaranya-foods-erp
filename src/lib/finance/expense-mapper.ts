import type { Expense } from "@prisma/client";
import type { ExpenseRecord } from "./types";
import { categoryToLabel } from "./expense-categories";

export function mapExpenseToRecord(
  e: Expense & { branch?: { name: string } | null },
): ExpenseRecord {
  const dept =
    e.reference?.replace(/^(packaging|office):/, "") ||
    e.reference ||
    undefined;

  return {
    id: e.id,
    category: categoryToLabel(e.category, e.reference),
    description: e.description,
    amount: Number(e.amount),
    department: dept,
    branchName: e.branch?.name,
    expenseDate: e.expenseDate.toISOString().slice(0, 10),
    status: "APPROVED",
  };
}
