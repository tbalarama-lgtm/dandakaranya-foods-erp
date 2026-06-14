import { apiHandler, jsonOk } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { toNumber } from "@/lib/utils";

export const GET = apiHandler(
  async () => {
    const [expenses, accounts, entries] = await Promise.all([
      prisma.expense.findMany({ take: 50, orderBy: { expenseDate: "desc" } }),
      prisma.ledgerAccount.findMany({ where: { active: true } }),
      prisma.ledgerEntry.findMany({
        take: 50,
        orderBy: { entryDate: "desc" },
        include: { account: true },
      }),
    ]);
    const totalExpenses = expenses.reduce((s, e) => s + toNumber(e.amount), 0);
    return jsonOk({ expenses, accounts, entries, totalExpenses });
  },
  { permission: "finance.view" },
);
