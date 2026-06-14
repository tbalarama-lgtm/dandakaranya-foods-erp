import { prisma } from "@/lib/db";
import { isPrismaConnectionError } from "@/lib/db-connection";
import { isPrismaValidationError } from "@/lib/prisma-schema-ready";

export type ProcurementDelegate =
  | "vendorContract"
  | "procurementRFQ"
  | "goodsReceiptNote"
  | "vendorDocument"
  | "vendorQualityRecord"
  | "procurementBudget"
  | "procurementApproval"
  | "gRNItem"
  | "rFQEvent"
  | "rFQVendorInvitation"
  | "rFQNegotiation"
  | "pOEvent"
  | "gRNEvent"
  | "gRNInspection"
  | "gRNBatchTrace"
  | "warehouseBin"
  | "gRNVendorReturn"
  | "complianceAuditLog"
  | "approvalWorkflowEvent"
  | "approvalComment"
  | "approvalMatrixRule"
  | "approvalDelegation"
  | "budgetAuditLog"
  | "budgetApproval"
  | "budgetRevision"
  | "budgetForecastPoint"
  | "budgetPurchaseLink"
  | "budgetMultiYearPlan"
  | "inventoryReservation"
  | "inventoryAdjustment"
  | "inventoryAuditLog"
  | "inventoryCycleCount"
  | "warehouseTransfer"
  | "warehouseTransferItem"
  | "pickPackDispatch"
  | "pickPackDispatchLine"
  | "inventoryForecastPoint";

export function hasPrismaDelegate(model: ProcurementDelegate): boolean {
  const delegate = (prisma as unknown as Record<string, unknown>)[model];
  return Boolean(delegate && typeof delegate === "object");
}

/** All procurement hub models present on the generated Prisma client. */
export function hasProcurementHubDelegates(): boolean {
  return (
    hasPrismaDelegate("procurementBudget") &&
    hasPrismaDelegate("procurementRFQ") &&
    hasPrismaDelegate("goodsReceiptNote") &&
    hasPrismaDelegate("procurementApproval")
  );
}

export async function safeModelCount(
  model: ProcurementDelegate,
  args?: { where?: Record<string, unknown> },
): Promise<number> {
  const delegate = (prisma as unknown as Record<string, { count?: (a: typeof args) => Promise<number> }>)[model];
  if (!delegate?.count) return 0;
  try {
    return await delegate.count(args);
  } catch (error) {
    if (isPrismaValidationError(error) || error instanceof TypeError) return 0;
    console.warn(`[prisma-safe] ${model}.count failed:`, error);
    return 0;
  }
}

export async function safeModelFindMany<T>(
  model: ProcurementDelegate,
  args: Record<string, unknown> = {},
): Promise<T[]> {
  const delegate = (prisma as unknown as Record<string, { findMany?: (a: Record<string, unknown>) => Promise<T[]> }>)[
    model
  ];
  if (!delegate?.findMany) return [];
  try {
    return await delegate.findMany(args);
  } catch (error) {
    if (isPrismaValidationError(error) || error instanceof TypeError) return [];
    console.warn(`[prisma-safe] ${model}.findMany failed:`, error);
    return [];
  }
}

export async function safeModelFindUnique<T>(
  model: ProcurementDelegate,
  args: Record<string, unknown>,
): Promise<T | null> {
  const delegate = (prisma as unknown as Record<string, { findUnique?: (a: Record<string, unknown>) => Promise<T | null> }>)[
    model
  ];
  if (!delegate?.findUnique) return null;
  try {
    return await delegate.findUnique(args);
  } catch (error) {
    if (isPrismaValidationError(error) || error instanceof TypeError) return null;
    console.warn(`[prisma-safe] ${model}.findUnique failed:`, error);
    return null;
  }
}

/** Runs a Prisma query; returns fallback when the client delegate is missing or validation fails. */
export async function safeQuery<T>(fn: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (isPrismaValidationError(error) || error instanceof TypeError) {
      console.warn("[prisma-safe] query fallback:", error instanceof Error ? error.message : error);
      return fallback;
    }

    if (isPrismaConnectionError(error)) {
      console.warn("[prisma-safe] connection/pool fallback:", error instanceof Error ? error.message : error);
      return fallback;
    }

    const message = error instanceof Error ? error.message : String(error);
    if (message.includes("does not exist in the current database")) {
      console.warn("[prisma-safe] schema drift fallback:", message);
      return fallback;
    }

    throw error;
  }
}
