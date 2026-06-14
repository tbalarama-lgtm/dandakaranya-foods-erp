"use server";

import { revalidatePath } from "next/cache";
import type {
  ApprovalWorkflowAction,
  ProcurementApprovalState,
  ProcurementApprovalType,
} from "@prisma/client";
import { actionOk, type ActionResult } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { shouldAutoEscalate } from "@/lib/approval-matrix";
import {
  ensurePurchaseApprovals,
  getApprovalDetail,
} from "@/lib/approval-metrics";
import { syncPurchaseLifecycle } from "@/lib/procurement-metrics";
import { APPROVAL_ACTION_LABELS, APPROVAL_TYPE_LABELS } from "@/lib/approval-types";
import { prisma } from "@/lib/db";
import { upsertNotification } from "@/lib/notifications";
import { requirePermission } from "@/lib/session";

const REVALIDATE_PATHS = [
  "/procurement/approvals",
  "/procurement",
  "/purchases",
  "/notifications",
];

function revalidateApprovalPaths(purchaseId?: string) {
  for (const p of REVALIDATE_PATHS) revalidatePath(p);
  if (purchaseId) revalidatePath(`/procurement/approvals/${purchaseId}`);
  revalidatePath("/procurement/approvals/mobile");
}

async function recordEvent(input: {
  purchaseId: string;
  action: ApprovalWorkflowAction;
  title: string;
  detail?: string;
  comment?: string;
  approvalType?: ProcurementApprovalType;
  actorId?: string;
  metadata?: Record<string, unknown>;
}) {
  const delegate = (prisma as unknown as Record<string, { create?: (args: unknown) => Promise<unknown> }>)
    .approvalWorkflowEvent;
  if (!delegate?.create) return;

  await delegate.create({
    data: {
      purchaseId: input.purchaseId,
      action: input.action,
      title: input.title,
      detail: input.detail ?? null,
      comment: input.comment ?? null,
      approvalType: input.approvalType ?? null,
      actorId: input.actorId ?? null,
      metadata: input.metadata ?? {},
    },
  });
}

async function notifyApprovers(input: {
  purchaseId: string;
  purchaseNumber: string;
  title: string;
  message: string;
  severity: "INFO" | "WARNING" | "CRITICAL";
  ruleKey?: string;
}) {
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MANAGER", "ACCOUNTANT"] }, active: true },
    select: { id: true },
    take: 8,
  });

  for (const u of admins) {
    await upsertNotification({
      userId: u.id,
      title: input.title,
      message: input.message,
      category: "APPROVAL",
      severity: input.severity,
      link: `/procurement/approvals/${input.purchaseId}`,
      entityType: "Purchase",
      entityId: input.purchaseId,
      ruleKey: input.ruleKey,
      metadata: { purchaseNumber: input.purchaseNumber },
    });
  }
}

async function checkFullyApproved(purchaseId: string, userId: string) {
  const detail = await getApprovalDetail(purchaseId);
  if (!detail) return;

  const allApproved = detail.requiredLevels.every((type) => {
    const level = detail.row.levels.find((l) => l.type === type);
    return level?.status === "APPROVED";
  });

  if (allApproved) {
    await prisma.purchase.update({
      where: { id: purchaseId },
      data: { approvalStatus: "APPROVED", approvedById: userId, approvedAt: new Date() },
    });
    await recordEvent({
      purchaseId,
      action: "APPROVE",
      title: "Workflow complete — all levels approved",
      actorId: userId,
    });
    const p = await prisma.purchase.findUnique({ where: { id: purchaseId }, select: { purchaseNumber: true } });
    if (p) {
      await notifyApprovers({
        purchaseId,
        purchaseNumber: p.purchaseNumber,
        title: "PO fully approved",
        message: `${p.purchaseNumber} cleared all approval gates and is ready for execution.`,
        severity: "INFO",
        ruleKey: `po-approved-${purchaseId}`,
      });
    }
  }
}

export async function executeApprovalAction(input: {
  purchaseId: string;
  approvalType: ProcurementApprovalType;
  action: "APPROVE" | "REJECT" | "SEND_BACK" | "ESCALATE";
  comment?: string;
  delegateToUserId?: string;
}): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("purchases.edit");
  await ensurePurchaseApprovals(input.purchaseId);

  const approval = await prisma.procurementApproval.findUnique({
    where: {
      purchaseId_approvalType: { purchaseId: input.purchaseId, approvalType: input.approvalType },
    },
  });
  if (!approval) return { ok: false, error: "Approval step not found" };

  const purchase = await prisma.purchase.findUnique({
    where: { id: input.purchaseId },
    select: { purchaseNumber: true, total: true },
  });
  if (!purchase) return { ok: false, error: "Purchase not found" };

  const levelLabel = APPROVAL_TYPE_LABELS[input.approvalType];
  const now = new Date();
  let workflowAction: ApprovalWorkflowAction = "COMMENT";

  switch (input.action) {
    case "APPROVE":
      workflowAction = "APPROVE";
      await prisma.procurementApproval.update({
        where: { id: approval.id },
        data: {
          status: "APPROVED",
          approvedById: user.id,
          approvedAt: now,
          notes: input.comment ?? approval.notes,
          sentBackAt: null,
        },
      });
      break;
    case "REJECT":
      workflowAction = "REJECT";
      await prisma.procurementApproval.update({
        where: { id: approval.id },
        data: {
          status: "REJECTED",
          approvedById: user.id,
          approvedAt: now,
          notes: input.comment ?? null,
        },
      });
      await prisma.purchase.update({
        where: { id: input.purchaseId },
        data: { approvalStatus: "REJECTED" },
      });
      break;
    case "SEND_BACK":
      workflowAction = "SEND_BACK";
      await prisma.procurementApproval.update({
        where: { id: approval.id },
        data: {
          status: "SENT_BACK",
          sentBackAt: now,
          notes: input.comment ?? null,
          approvedById: user.id,
          approvedAt: null,
        },
      });
      break;
    case "ESCALATE":
      workflowAction = "ESCALATE";
      await prisma.procurementApproval.update({
        where: { id: approval.id },
        data: {
          status: "ESCALATED",
          escalatedAt: now,
          dueAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
          notes: input.comment ?? approval.notes,
        },
      });
      break;
  }

  const turnaroundHours = approval.createdAt
    ? Math.round((now.getTime() - approval.createdAt.getTime()) / (1000 * 60 * 60))
    : 0;
  const overdue = approval.dueAt ? now.getTime() > approval.dueAt.getTime() : false;

  await recordEvent({
    purchaseId: input.purchaseId,
    action: workflowAction,
    title: `${levelLabel} — ${APPROVAL_ACTION_LABELS[workflowAction]}`,
    detail: input.comment ?? undefined,
    comment: input.comment,
    approvalType: input.approvalType,
    actorId: user.id,
    metadata: { turnaroundHours, overdue },
  });

  if (input.comment?.trim()) {
    await prisma.approvalComment.create({
      data: {
        purchaseId: input.purchaseId,
        approvalType: input.approvalType,
        userId: user.id,
        body: input.comment.trim(),
      },
    });
  }

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: input.action === "REJECT" ? "DELETE" : "UPDATE",
    entityType: "ProcurementApproval",
    entityId: approval.id,
    message: `${APPROVAL_ACTION_LABELS[workflowAction]} ${levelLabel} for ${purchase.purchaseNumber}`,
    metadata: { purchaseId: input.purchaseId, approvalType: input.approvalType },
  });

  await notifyApprovers({
    purchaseId: input.purchaseId,
    purchaseNumber: purchase.purchaseNumber,
    title: `${levelLabel} ${APPROVAL_ACTION_LABELS[workflowAction]}`,
    message: `${purchase.purchaseNumber}: ${input.comment ?? "No comment provided"}`,
    severity: input.action === "REJECT" ? "CRITICAL" : input.action === "ESCALATE" ? "WARNING" : "INFO",
    ruleKey: `approval-${input.purchaseId}-${input.approvalType}-${input.action}`,
  });

  if (input.action === "APPROVE") {
    await checkFullyApproved(input.purchaseId, user.id);
    const total = Number(purchase.total);
    if (shouldAutoEscalate(total, { escalateAbove: 1000000, id: "", name: "", minPoValue: null, maxPoValue: null, department: null, classification: null, requiredLevels: [], slaHours: 24, requiresQc: false, requiresCompliance: false, seasonalOnly: false })) {
      const detail = await getApprovalDetail(input.purchaseId);
      const pending = detail?.row.levels.find(
        (l) => l.status === "PENDING" && l.type !== input.approvalType,
      );
      if (pending) {
        await recordEvent({
          purchaseId: input.purchaseId,
          action: "AUTO_ESCALATE",
          title: "High-value auto-escalation triggered",
          detail: `Next pending level: ${APPROVAL_TYPE_LABELS[pending.type]}`,
          actorId: user.id,
        });
      }
    }
  }

  await syncPurchaseLifecycle(input.purchaseId);
  revalidateApprovalPaths(input.purchaseId);
  return actionOk({ id: input.purchaseId });
}

export async function addApprovalComment(
  purchaseId: string,
  body: string,
  approvalType?: ProcurementApprovalType,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("purchases.view");
  if (!body.trim()) return { ok: false, error: "Comment cannot be empty" };

  await prisma.approvalComment.create({
    data: {
      purchaseId,
      approvalType: approvalType ?? null,
      userId: user.id,
      body: body.trim(),
    },
  });

  await recordEvent({
    purchaseId,
    action: "COMMENT",
    title: "Discussion comment added",
    comment: body.trim(),
    approvalType,
    actorId: user.id,
  });

  revalidateApprovalPaths(purchaseId);
  return actionOk({ id: purchaseId });
}

export async function delegateApproval(
  purchaseId: string,
  approvalType: ProcurementApprovalType,
  toUserId: string,
  note?: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("purchases.edit");
  await ensurePurchaseApprovals(purchaseId);

  await prisma.procurementApproval.update({
    where: { purchaseId_approvalType: { purchaseId, approvalType } },
    data: { delegatedToId: toUserId, notes: note ?? undefined },
  });

  await recordEvent({
    purchaseId,
    action: "DELEGATE",
    title: `${APPROVAL_TYPE_LABELS[approvalType]} delegated`,
    detail: note,
    approvalType,
    actorId: user.id,
    metadata: { toUserId },
  });

  await upsertNotification({
    userId: toUserId,
    title: "Approval delegated to you",
    message: note ?? `You have been assigned ${APPROVAL_TYPE_LABELS[approvalType]} approval.`,
    category: "APPROVAL",
    severity: "INFO",
    link: `/procurement/approvals/${purchaseId}`,
    entityType: "Purchase",
    entityId: purchaseId,
  });

  revalidateApprovalPaths(purchaseId);
  return actionOk({ id: purchaseId });
}

export async function approvePurchaseLevel(
  purchaseId: string,
  approvalType: ProcurementApprovalType,
  status: ProcurementApprovalState,
): Promise<ActionResult<{ id: string }>> {
  if (status === "APPROVED") {
    return executeApprovalAction({ purchaseId, approvalType, action: "APPROVE" });
  }
  if (status === "REJECTED") {
    return executeApprovalAction({ purchaseId, approvalType, action: "REJECT" });
  }
  if (status === "SENT_BACK") {
    return executeApprovalAction({ purchaseId, approvalType, action: "SEND_BACK" });
  }
  if (status === "ESCALATED") {
    return executeApprovalAction({ purchaseId, approvalType, action: "ESCALATE" });
  }
  return { ok: false, error: "Unsupported status transition" };
}

export async function runBudgetValidation(purchaseId: string): Promise<ActionResult<{ status: string }>> {
  const user = await requirePermission("purchases.view");
  const detail = await getApprovalDetail(purchaseId);
  if (!detail) return { ok: false, error: "Purchase not found" };

  await recordEvent({
    purchaseId,
    action: "BUDGET_VALIDATE",
    title: "Budget validation executed",
    detail: detail.budgetAnalysis.message,
    actorId: user.id,
    metadata: detail.budgetAnalysis as unknown as Record<string, unknown>,
  });

  if (detail.budgetAnalysis.status === "OVERSPEND") {
    await notifyApprovers({
      purchaseId,
      purchaseNumber: detail.row.purchaseNumber,
      title: "Budget overspend alert",
      message: detail.budgetAnalysis.message,
      severity: "CRITICAL",
      ruleKey: `budget-overspend-${purchaseId}`,
    });
  }

  revalidateApprovalPaths(purchaseId);
  return actionOk({ status: detail.budgetAnalysis.status });
}

export async function runComplianceGate(purchaseId: string): Promise<ActionResult<{ passed: boolean }>> {
  const user = await requirePermission("purchases.edit");
  const p = await prisma.purchase.findUnique({
    where: { id: purchaseId },
    include: { vendor: { include: { documents: true } } },
  });
  if (!p) return { ok: false, error: "Purchase not found" };

  const fssai = p.vendor.documents.find((d) => d.docType === "FSSAI_LICENSE");
  const passed = Boolean(fssai && (!fssai.expiresAt || fssai.expiresAt.getTime() > Date.now()));

  await recordEvent({
    purchaseId,
    action: "COMPLIANCE_CHECK",
    title: passed ? "Compliance validation passed" : "Compliance validation failed",
    detail: passed ? "Supplier FSSAI certification valid" : "Missing or expired FSSAI certification",
    actorId: user.id,
    metadata: { passed },
  });

  revalidateApprovalPaths(purchaseId);
  return actionOk({ passed });
}

export async function runQcGate(purchaseId: string): Promise<ActionResult<{ passed: boolean }>> {
  const user = await requirePermission("purchases.edit");
  const grn = await prisma.goodsReceiptNote.findUnique({ where: { purchaseId } });
  const passed = grn?.qcPassed ?? false;

  await recordEvent({
    purchaseId,
    action: "QC_GATE",
    title: passed ? "QC gate cleared" : "QC gate pending",
    detail: passed ? "GRN QC inspection passed" : "Awaiting GRN QC completion",
    actorId: user.id,
    metadata: { passed, grnId: grn?.id ?? null },
  });

  revalidateApprovalPaths(purchaseId);
  return actionOk({ passed });
}
