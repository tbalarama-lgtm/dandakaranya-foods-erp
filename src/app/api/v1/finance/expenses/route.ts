import { NextResponse } from "next/server";
import { apiHandler, jsonOk } from "@/lib/api/handler";
import { prisma } from "@/lib/db";
import { mapExpenseToRecord } from "@/lib/finance/expense-mapper";
import { uiCategoryToPrisma } from "@/lib/finance/expense-categories";
import type { ExpenseCategory } from "@prisma/client";

export const GET = apiHandler(
  async () => {
    const expenses = await prisma.expense.findMany({
      take: 100,
      orderBy: { expenseDate: "desc" },
      include: { branch: { select: { name: true } } },
    });
    return jsonOk(expenses.map(mapExpenseToRecord));
  },
  { permission: "finance.view" },
);

export const POST = apiHandler(
  async (ctx, request) => {
    const body = await request.json();
    const { category, description, amount, department, expenseDate, branchId } = body as {
      category: string;
      description: string;
      amount: number | string;
      department?: string;
      expenseDate?: string;
      branchId?: string;
    };

    if (!description?.trim()) {
      return NextResponse.json({ error: "Description is required" }, { status: 400 });
    }

    const num = Number(amount);
    if (!Number.isFinite(num) || num <= 0) {
      return NextResponse.json({ error: "Enter a valid amount greater than zero" }, { status: 400 });
    }

    const { category: prismaCategory, reference } = uiCategoryToPrisma(category, department);

    let resolvedBranchId = branchId || null;
    const branchName = (body as { branchName?: string }).branchName;
    if (!resolvedBranchId && branchName) {
      const branch = await prisma.branch.findFirst({
        where: { name: branchName },
      });
      resolvedBranchId = branch?.id ?? null;
    }

    const expense = await prisma.expense.create({
      data: {
        category: prismaCategory as ExpenseCategory,
        description: description.trim(),
        amount: num,
        reference,
        expenseDate: expenseDate ? new Date(expenseDate) : new Date(),
        branchId: resolvedBranchId,
        userId: ctx.user.id,
      },
      include: { branch: { select: { name: true } } },
    });

    return jsonOk(mapExpenseToRecord(expense), 201);
  },
  { permission: "finance.manage" },
);
