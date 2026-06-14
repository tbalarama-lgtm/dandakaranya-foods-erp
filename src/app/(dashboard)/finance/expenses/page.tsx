import { FinancePageHeader } from "@/components/finance/finance-page-header";
import { FinanceExpensesClient } from "@/components/finance/finance-expenses-client";
import { mapExpenseToRecord } from "@/lib/finance/expense-mapper";
import { MOCK_EXPENSES } from "@/lib/finance/mock-data";
import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/safe-prisma";

export const dynamic = "force-dynamic";

export default async function FinanceExpensesPage() {
  const expenses = await safeQuery(
    () =>
      prisma.expense.findMany({
        take: 100,
        orderBy: { expenseDate: "desc" },
        include: { branch: { select: { name: true } } },
      }),
    [],
  );

  const initial = expenses.length > 0 ? expenses.map(mapExpenseToRecord) : MOCK_EXPENSES;

  return (
    <>
      <FinancePageHeader
        title="Expense management"
        description="Salaries, utilities, raw materials, packaging, marketing, and office expenses with approval workflow."
      />
      <FinanceExpensesClient initial={initial} />
    </>
  );
}
