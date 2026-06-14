"use server";

import { revalidatePath } from "next/cache";
import { randomBytes } from "crypto";
import {
  ActivityAction,
  type DocumentClassification,
  type DocumentDepartment,
  type DocumentWorkflowStatus,
} from "@prisma/client";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import {
  canAccessDepartment,
  canApproveDocuments,
  canDeleteDocuments,
  canManageDocuments,
  canUploadDocuments,
} from "@/lib/documents/permissions";
import { getCurrentUser } from "@/lib/session";

const metadataSchema = z.object({
  title: z.string().trim().min(2),
  department: z.enum([
    "COMPANY_LEGAL",
    "HR",
    "FINANCE",
    "PRODUCTION",
    "VENDOR_PROCUREMENT",
    "SALES_MARKETING",
    "RD",
  ]),
  folderId: z.string().optional(),
  classification: z.enum(["PUBLIC", "INTERNAL", "CONFIDENTIAL"]).default("INTERNAL"),
  tags: z.array(z.string()).default([]),
  description: z.string().optional(),
  expiryDate: z.string().optional(),
  employeeRef: z.string().optional(),
  documentType: z.string().optional(),
  internalNotes: z.string().optional(),
});

function revalidateVault() {
  revalidatePath("/documents");
  revalidatePath("/documents/all");
  revalidatePath("/documents/approvals");
  revalidatePath("/documents/expiring");
  revalidatePath("/documents/archive");
  revalidatePath("/documents/trash");
}

export async function finalizeDocumentUpload(
  documentId: string,
  meta: z.infer<typeof metadataSchema>,
  fileMeta: {
    fileName: string;
    fileUrl: string;
    mimeType: string;
    sizeBytes: number;
    checksum: string;
    fileType: import("@prisma/client").DocumentFileType;
  },
): Promise<ActionResult<{ id: string }>> {
  const user = await getCurrentUser();
  if (!user) return actionFail("Please sign in again.");
  if (!canUploadDocuments(user.role)) return actionFail("You cannot upload documents.");

  const parsed = metadataSchema.safeParse(meta);
  if (!parsed.success) {
    return actionFail(parsed.error.issues[0]?.message ?? "Invalid document metadata.");
  }
  if (!canAccessDepartment(user.role, parsed.data.department as DocumentDepartment)) {
    return actionFail("You cannot upload to this department.");
  }

  try {
    const doc = await prisma.document.create({
      data: {
        id: documentId,
        title: parsed.data.title,
        fileName: fileMeta.fileName,
        fileUrl: fileMeta.fileUrl,
        mimeType: fileMeta.mimeType,
        fileType: fileMeta.fileType,
        sizeBytes: fileMeta.sizeBytes,
        checksum: fileMeta.checksum,
        department: parsed.data.department,
        folderId: parsed.data.folderId || null,
        classification: parsed.data.classification as DocumentClassification,
        tags: parsed.data.tags,
        description: parsed.data.description || null,
        expiryDate: parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null,
        employeeRef: parsed.data.employeeRef || null,
        documentType: parsed.data.documentType || null,
        internalNotes: parsed.data.internalNotes || null,
        uploadedById: user.id,
        workflowStatus: "DRAFT",
        version: 1,
      },
    });

    await prisma.documentVersion.create({
      data: {
        documentId: doc.id,
        version: 1,
        fileName: fileMeta.fileName,
        fileUrl: fileMeta.fileUrl,
        mimeType: fileMeta.mimeType,
        sizeBytes: fileMeta.sizeBytes,
        uploadedById: user.id,
        changeNotes: "Initial upload",
      },
    });

    await logActivity({
      userId: user.id,
      userName: user.name,
      action: ActivityAction.CREATE,
      entityType: "Document",
      entityId: doc.id,
      message: `Uploaded document "${doc.title}"`,
    });

    revalidateVault();
    return actionOk({ id: doc.id });
  } catch (error) {
    console.error("[finalizeDocumentUpload]", error);
    return actionFail("Could not save document record.");
  }
}

export async function updateDocumentWorkflow(
  documentId: string,
  status: DocumentWorkflowStatus,
  comment?: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionFail("Please sign in again.");

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.deletedAt) return actionFail("Document not found.");
  if (!canAccessDepartment(user.role, doc.department)) return actionFail("Access denied.");

  if (status === "UNDER_REVIEW" && !canUploadDocuments(user.role)) {
    return actionFail("You cannot submit for review.");
  }
  if (["APPROVED", "REJECTED"].includes(status) && !canApproveDocuments(user.role)) {
    return actionFail("You cannot approve or reject documents.");
  }
  if (status === "ARCHIVED" && !canManageDocuments(user.role)) {
    return actionFail("You cannot archive documents.");
  }

  try {
    await prisma.document.update({
      where: { id: documentId },
      data: {
        workflowStatus: status,
        approvedById: status === "APPROVED" ? user.id : doc.approvedById,
        approvedAt: status === "APPROVED" ? new Date() : doc.approvedAt,
        rejectedReason: status === "REJECTED" ? comment ?? "Rejected" : null,
        archivedAt: status === "ARCHIVED" ? new Date() : doc.archivedAt,
        tags:
          status === "APPROVED"
            ? [...new Set([...doc.tags.filter((t) => t !== "Pending"), "Approved"])]
            : doc.tags,
      },
    });

    if (comment && (status === "REJECTED" || status === "UNDER_REVIEW")) {
      await prisma.documentComment.create({
        data: { documentId, userId: user.id, body: comment },
      });
    }

    await logActivity({
      userId: user.id,
      userName: user.name,
      action: ActivityAction.UPDATE,
      entityType: "Document",
      entityId: documentId,
      message: `Document workflow → ${status}`,
    });

    revalidateVault();
    revalidatePath(`/documents/${documentId}`);
    return actionOk(undefined);
  } catch {
    return actionFail("Could not update workflow.");
  }
}

export async function toggleDocumentStar(documentId: string): Promise<ActionResult<{ starred: boolean }>> {
  const user = await getCurrentUser();
  if (!user) return actionFail("Please sign in again.");

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.deletedAt) return actionFail("Document not found.");
  if (!canAccessDepartment(user.role, doc.department)) return actionFail("Access denied.");

  const updated = await prisma.document.update({
    where: { id: documentId },
    data: { isStarred: !doc.isStarred },
  });

  revalidateVault();
  return actionOk({ starred: updated.isStarred });
}

export async function moveDocumentToTrash(documentId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionFail("Please sign in again.");
  if (!canDeleteDocuments(user.role)) return actionFail("You cannot delete documents.");

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc) return actionFail("Document not found.");
  if (!canAccessDepartment(user.role, doc.department)) return actionFail("Access denied.");

  await prisma.document.update({
    where: { id: documentId },
    data: { deletedAt: new Date() },
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.DELETE,
    entityType: "Document",
    entityId: documentId,
    message: `Moved "${doc.title}" to trash`,
  });

  revalidateVault();
  revalidatePath(`/documents/${documentId}`);
  return actionOk(undefined);
}

export async function restoreDocument(documentId: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canManageDocuments(user.role)) return actionFail("You cannot restore documents.");

  await prisma.document.update({
    where: { id: documentId },
    data: { deletedAt: null },
  });

  revalidateVault();
  return actionOk(undefined);
}

export async function addDocumentComment(documentId: string, body: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return actionFail("Please sign in again.");
  if (!body.trim()) return actionFail("Comment cannot be empty.");

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.deletedAt) return actionFail("Document not found.");
  if (!canAccessDepartment(user.role, doc.department)) return actionFail("Access denied.");

  await prisma.documentComment.create({
    data: { documentId, userId: user.id, body: body.trim() },
  });

  revalidatePath(`/documents/${documentId}`);
  return actionOk(undefined);
}

export async function createShareLink(
  documentId: string,
  expiresInDays = 7,
): Promise<ActionResult<{ token: string; expiresAt: string }>> {
  const user = await getCurrentUser();
  if (!user || !canManageDocuments(user.role)) return actionFail("You cannot share documents.");

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.deletedAt) return actionFail("Document not found.");

  const token = randomBytes(24).toString("hex");
  const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

  await prisma.document.update({
    where: { id: documentId },
    data: { isShared: true, sharedLinkToken: token, sharedLinkExpiry: expiresAt },
  });

  revalidatePath(`/documents/${documentId}`);
  return actionOk({ token, expiresAt: expiresAt.toISOString() });
}

export async function renameDocument(documentId: string, title: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user || !canManageDocuments(user.role)) return actionFail("You cannot rename documents.");

  if (title.trim().length < 2) return actionFail("Title must be at least 2 characters.");

  await prisma.document.update({
    where: { id: documentId },
    data: { title: title.trim() },
  });

  revalidateVault();
  revalidatePath(`/documents/${documentId}`);
  return actionOk(undefined);
}

export async function logDocumentDownload(documentId: string, ipAddress?: string) {
  const user = await getCurrentUser();
  if (!user) return;

  const doc = await prisma.document.findUnique({ where: { id: documentId } });
  if (!doc || doc.deletedAt || !canAccessDepartment(user.role, doc.department)) return;

  await prisma.documentDownloadLog.create({
    data: { documentId, userId: user.id, ipAddress: ipAddress ?? null },
  });
}
