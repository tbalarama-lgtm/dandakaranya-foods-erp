"use server";

import { revalidatePath } from "next/cache";
import type { BudgetApprovalType, BudgetScenarioType } from "@prisma/client";
import { actionOk, type ActionResult } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { validateBudgetCommit } from "@/lib/budget-engine";
import { getBudgetDetail } from "@/lib/budget-metrics";
import { DEFAULT_CRITICAL_THRESHOLD, DEFAULT_LOCK_THRESHOLD, DEFAULT_WARNING_THRESHOLD } from "@/lib/budget-types";
import { prisma } from "@/lib/db";
import { upsertNotification } from "@/lib/notifications";
import { requirePermission } from "@/lib/session";

function revalidateBudgetPaths(budgetId?: string) {
  revalidatePath("/procurement/budgets");
  revalidatePath("/procurement");
  revalidatePath("/procurement/approvals");
  if (budgetId) revalidatePath(`/procurement/budgets/${budgetId}`);
}

async function recordAudit(input: {
  budgetId: string;
  action: import("@prisma/client").BudgetAuditAction;
  title: string;
  detail?: string;
  actorId?: string;
  metadata?: Record<string, unknown>;
}) {
  const delegate = (prisma as unknown as Record<string, { create?: (args: unknown) => Promise<unknown> }>).budgetAuditLog;
  if (!delegate?.create) return;
  await delegate.create({
    data: {
      budgetId: input.budgetId,
      action: input.action,
      title: input.title,
      detail: input.detail ?? null,
      actorId: input.actorId ?? null,
      metadata: input.metadata ?? {},
    },
  });
}

async function notifyBudgetAlert(userIds: string[], title: string, message: string, budgetId: string) {
  for (const userId of userIds) {
    await upsertNotification({
      userId,
      title,
      message,
      category: "FINANCE",
      severity: "WARNING",
      link: `/procurement/budgets/${budgetId}`,
      entityType: "ProcurementBudget",
      entityId: budgetId,
    });
  }
}

export async function createBudgetRevision(
  budgetId: string,
  newAmount: number,
  reason?: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("purchases.edit");
  const budget = await prisma.procurementBudget.findUnique({ where: { id: budgetId } });
  if (!budget) return { ok: false, error: "Budget not found" };

  const prev = Number(budget.budgetAmount);
  const revisionCount = await prisma.budgetRevision.count({ where: { budgetId } });

  await prisma.$transaction([
    prisma.procurementBudget.update({
      where: { id: budgetId },
      data: { budgetAmount: newAmount, status: "PENDING_APPROVAL" },
    }),
    prisma.budgetRevision.create({
      data: {
        budgetId,
        revisionNumber: revisionCount + 1,
        previousAmount: prev,
        newAmount,
        reason: reason ?? null,
        userId: user.id,
      },
    }),
    prisma.budgetApproval.create({
      data: { budgetId, approvalType: "REVISION", status: "PENDING" },
    }),
  ]);

  await recordAudit({
    budgetId,
    action: "REVISED",
    title: `Budget revision #${revisionCount + 1} submitted`,
    detail: reason,
    actorId: user.id,
    metadata: { previousAmount: prev, newAmount },
  });

  revalidateBudgetPaths(budgetId);
  return actionOk({ id: budgetId });
}

export async function approveBudgetAction(
  budgetId: string,
  approvalType: BudgetApprovalType,
  approve: boolean,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("purchases.edit");

  await prisma.budgetApproval.updateMany({
    where: { budgetId, approvalType, status: "PENDING" },
    data: {
      status: approve ? "APPROVED" : "REJECTED",
      approvedById: user.id,
      approvedAt: new Date(),
    },
  });

  if (approve) {
    await prisma.procurementBudget.update({
      where: { id: budgetId },
      data: { status: "ACTIVE", approvedById: user.id, approvedAt: new Date() },
    });
  }

  await recordAudit({
    budgetId,
    action: approve ? "APPROVED" : "REJECTED",
    title: `${approvalType} ${approve ? "approved" : "rejected"}`,
    actorId: user.id,
  });

  revalidateBudgetPaths(budgetId);
  return actionOk({ id: budgetId });
}

export async function lockBudget(
  budgetId: string,
  reason: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("purchases.edit");

  await prisma.procurementBudget.update({
    where: { id: budgetId },
    data: { status: "LOCKED", lockedAt: new Date(), lockedReason: reason },
  });

  await recordAudit({
    budgetId,
    action: "LOCKED",
    title: "Budget locked",
    detail: reason,
    actorId: user.id,
  });

  revalidateBudgetPaths(budgetId);
  return actionOk({ id: budgetId });
}

export async function unlockBudget(budgetId: string): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("purchases.edit");

  await prisma.procurementBudget.update({
    where: { id: budgetId },
    data: { status: "ACTIVE", lockedAt: null, lockedReason: null },
  });

  await recordAudit({
    budgetId,
    action: "UNLOCKED",
    title: "Budget unlocked",
    actorId: user.id,
  });

  revalidateBudgetPaths(budgetId);
  return actionOk({ id: budgetId });
}

export async function commitPurchaseToBudget(
  purchaseId: string,
  budgetId: string,
): Promise<ActionResult<{ allowed: boolean }>> {
  const user = await requirePermission("purchases.edit");
  const [purchase, budget] = await Promise.all([
    prisma.purchase.findUnique({ where: { id: purchaseId }, select: { total: true, purchaseNumber: true } }),
    prisma.procurementBudget.findUnique({ where: { id: budgetId } }),
  ]);

  if (!purchase || !budget) return { ok: false, error: "Purchase or budget not found" };

  const poAmount = Number(purchase.total);
  const enforcement = validateBudgetCommit(
    {
      budgetAmount: Number(budget.budgetAmount),
      spentAmount: Number(budget.spentAmount),
      committedAmount: Number(budget.committedAmount),
      status: budget.status,
      enforcementLevel: budget.enforcementLevel,
      thresholds: {
        warning: Number(budget.warningThresholdPct) || DEFAULT_WARNING_THRESHOLD,
        critical: Number(budget.criticalThresholdPct) || DEFAULT_CRITICAL_THRESHOLD,
        lock: Number(budget.lockThresholdPct) || DEFAULT_LOCK_THRESHOLD,
      },
    },
    poAmount,
  );

  if (!enforcement.allowed) {
    await recordAudit({
      budgetId,
      action: "THRESHOLD_BREACH",
      title: "PO commitment blocked",
      detail: enforcement.message,
      actorId: user.id,
      metadata: { purchaseId, poAmount },
    });

    if (enforcement.requiresOverspendApproval) {
      await prisma.budgetApproval.create({
        data: { budgetId, approvalType: "OVERSPEND", status: "PENDING", notes: enforcement.message },
      });
    }

    return { ok: false, error: enforcement.message };
  }

  await prisma.$transaction([
    prisma.budgetPurchaseLink.upsert({
      where: { budgetId_purchaseId: { budgetId, purchaseId } },
      create: { budgetId, purchaseId, committedAmount: poAmount, status: "COMMITTED" },
      update: { committedAmount: poAmount },
    }),
    prisma.procurementBudget.update({
      where: { id: budgetId },
      data: { committedAmount: { increment: poAmount } },
    }),
    prisma.purchase.update({ where: { id: purchaseId }, data: { budgetId } }),
  ]);

  await recordAudit({
    budgetId,
    action: "PO_COMMITTED",
    title: `PO ${purchase.purchaseNumber} committed`,
    detail: `₹${poAmount.toLocaleString("en-IN")} reserved against budget`,
    actorId: user.id,
    metadata: { purchaseId },
  });

  if (enforcement.tier === "WARNING" || enforcement.tier === "CRITICAL") {
    const admins = await prisma.user.findMany({
      where: { role: { in: ["ADMIN", "MANAGER", "ACCOUNTANT"] }, active: true },
      select: { id: true },
      take: 5,
    });
    await notifyBudgetAlert(
      admins.map((a) => a.id),
      `Budget ${enforcement.tier.toLowerCase()} alert`,
      enforcement.message,
      budgetId,
    );
    await recordAudit({ budgetId, action: "ALERT_SENT", title: enforcement.message, actorId: user.id });
  }

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: "UPDATE",
    entityType: "ProcurementBudget",
    entityId: budgetId,
    message: `Committed PO ${purchase.purchaseNumber} to budget`,
  });

  revalidateBudgetPaths(budgetId);
  return actionOk({ allowed: true });
}

export async function updateBudgetScenario(
  budgetId: string,
  scenario: BudgetScenarioType,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("purchases.edit");

  await prisma.procurementBudget.update({
    where: { id: budgetId },
    data: { scenario },
  });

  await recordAudit({
    budgetId,
    action: "SCENARIO_UPDATED",
    title: `Scenario set to ${scenario}`,
    actorId: user.id,
  });

  revalidateBudgetPaths(budgetId);
  return actionOk({ id: budgetId });
}

export async function runBudgetForecast(budgetId: string): Promise<ActionResult<{ forecast: number }>> {
  const user = await requirePermission("purchases.view");
  const detail = await getBudgetDetail(budgetId);
  if (!detail) return { ok: false, error: "Budget not found" };

  const historical = detail.varianceTrend.map((v) => v.actual);
  const { forecastSpend } = await import("@/lib/budget-engine");
  const forecast = forecastSpend(historical, {
    seasonalFactor: detail.row.seasonalFlag ? 1.15 : 1,
    inflationPct: 6.5,
    scenario: detail.row.scenario,
  });

  await prisma.procurementBudget.update({
    where: { id: budgetId },
    data: { forecastAmount: forecast },
  });

  await recordAudit({
    budgetId,
    action: "FORECAST_UPDATED",
    title: "AI spend forecast updated",
    detail: `Projected monthly spend: ₹${forecast.toLocaleString("en-IN")}`,
    actorId: user.id,
    metadata: { forecast },
  });

  revalidateBudgetPaths(budgetId);
  return actionOk({ forecast });
}
