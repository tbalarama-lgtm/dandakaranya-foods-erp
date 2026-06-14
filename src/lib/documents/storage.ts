import "server-only";

import { createHash } from "crypto";
import { mkdir, writeFile, unlink } from "fs/promises";
import { join } from "path";
import { isSupabaseStorageEnabled } from "@/lib/supabase/admin";
import { detectFileType } from "./format";
import { toSupabaseFileUrl } from "./file-url";
import { deleteFromSupabaseStorage, uploadToSupabaseStorage } from "./supabase-storage";

export const DOCUMENT_UPLOAD_DIR = join(process.cwd(), "public", "uploads", "documents");

export const ALLOWED_DOCUMENT_TYPES = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "image/png",
  "image/jpeg",
  "application/zip",
  "application/x-zip-compressed",
]);

export const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;

export function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
}

export function getStorageMode() {
  return isSupabaseStorageEnabled() ? "supabase" as const : "local" as const;
}

export async function saveDocumentFile(documentId: string, file: File) {
  if (!ALLOWED_DOCUMENT_TYPES.has(file.type) && !file.name.match(/\.(pdf|docx|doc|xlsx|xls|png|jpe?g|zip)$/i)) {
    throw new Error("Unsupported file type. Allowed: PDF, DOCX, XLSX, PNG, JPG, ZIP.");
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    throw new Error("File exceeds 25 MB limit.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const checksum = createHash("sha256").update(buffer).digest("hex");
  const safeName = safeFileName(file.name);
  const storedName = `${Date.now()}-${safeName}`;
  const mimeType = file.type || "application/octet-stream";
  const fileType = detectFileType(file.name, file.type);

  if (isSupabaseStorageEnabled()) {
    const storageKey = `${documentId}/${storedName}`;
    await uploadToSupabaseStorage(storageKey, buffer, mimeType);

    return {
      fileName: file.name,
      storedName,
      fileUrl: toSupabaseFileUrl(storageKey),
      mimeType,
      sizeBytes: file.size,
      checksum,
      fileType,
    };
  }

  const dir = join(DOCUMENT_UPLOAD_DIR, documentId);
  await mkdir(dir, { recursive: true });
  const diskPath = join(dir, storedName);
  await writeFile(diskPath, buffer);

  return {
    fileName: file.name,
    storedName,
    fileUrl: `/uploads/documents/${documentId}/${storedName}`,
    mimeType,
    sizeBytes: file.size,
    checksum,
    fileType,
  };
}

export async function deleteDocumentFile(fileUrl: string) {
  if (fileUrl.startsWith("sb://")) {
    await deleteFromSupabaseStorage(fileUrl);
    return;
  }

  if (fileUrl.startsWith("/uploads/")) {
    const diskPath = join(process.cwd(), "public", fileUrl.replace(/^\//, ""));
    try {
      await unlink(diskPath);
    } catch {
      // File may already be gone
    }
  }
}

/** Future-ready hooks for OCR / AI pipeline */
export type DocumentIntelligencePayload = {
  documentId: string;
  ocrText?: string;
  aiSummary?: string;
  suggestedTags?: string[];
};

export function buildIntelligenceStub(documentId: string): DocumentIntelligencePayload {
  return { documentId, suggestedTags: [] };
}
