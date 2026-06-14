"use server";

import { revalidatePath } from "next/cache";
import { ProcurementStage } from "@prisma/client";
import { actionOk, type ActionResult } from "@/lib/action-result";
import { approvePurchaseLevel as workflowApproveLevel } from "@/actions/approval-workflow";
import {
  executeApprovalAction as workflowExecuteApprovalAction,
  addApprovalComment as workflowAddApprovalComment,
  delegateApproval as workflowDelegateApproval,
  runBudgetValidation as workflowRunBudgetValidation,
  runComplianceGate as workflowRunComplianceGate,
  runQcGate as workflowRunQcGate,
} from "@/actions/approval-workflow";
import { createRfq as rfqCreateRfq } from "@/actions/rfq";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";
import { syncPurchaseLifecycle } from "@/lib/procurement-metrics";

/** @deprecated Use createRfq from @/actions/rfq */
export async function createRFQ(...args: Parameters<typeof rfqCreateRfq>) {
  return rfqCreateRfq(...args);
}

export async function approvePurchaseLevel(...args: Parameters<typeof workflowApproveLevel>) {
  return workflowApproveLevel(...args);
}

export async function executeApprovalAction(...args: Parameters<typeof workflowExecuteApprovalAction>) {
  return workflowExecuteApprovalAction(...args);
}

export async function addApprovalComment(...args: Parameters<typeof workflowAddApprovalComment>) {
  return workflowAddApprovalComment(...args);
}

export async function delegateApproval(...args: Parameters<typeof workflowDelegateApproval>) {
  return workflowDelegateApproval(...args);
}

export async function runBudgetValidation(...args: Parameters<typeof workflowRunBudgetValidation>) {
  return workflowRunBudgetValidation(...args);
}

export async function runComplianceGate(...args: Parameters<typeof workflowRunComplianceGate>) {
  return workflowRunComplianceGate(...args);
}

export async function runQcGate(...args: Parameters<typeof workflowRunQcGate>) {
  return workflowRunQcGate(...args);
}

export async function updateProcurementStage(
  purchaseId: string,
  stage: ProcurementStage,
): Promise<ActionResult<{ id: string }>> {
  await requirePermission("purchases.edit");

  await prisma.purchase.update({
    where: { id: purchaseId },
    data: { procurementStage: stage },
  });

  await syncPurchaseLifecycle(purchaseId);

  revalidatePath("/procurement");
  revalidatePath("/purchases");
  return actionOk({ id: purchaseId });
}

export async function recordBill(purchaseId: string, billUrl?: string): Promise<ActionResult<{ id: string }>> {
  await requirePermission("purchases.edit");

  await prisma.purchase.update({
    where: { id: purchaseId },
    data: {
      billUrl: billUrl || null,
      billRecordedAt: new Date(),
      procurementStage: "BILLED",
    },
  });

  await syncPurchaseLifecycle(purchaseId);

  revalidatePath("/procurement/payables");
  revalidatePath("/procurement");
  return actionOk({ id: purchaseId });
}

/** @deprecated Use approvePurchaseLevel */
export async function approvePurchase(id: string): Promise<ActionResult<{ id: string }>> {
  return workflowApproveLevel(id, "PROCUREMENT", "APPROVED");
}
