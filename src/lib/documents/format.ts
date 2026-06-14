import type { DocumentFileType } from "@prisma/client";
import { extname } from "path";

const EXT_TO_TYPE: Record<string, DocumentFileType> = {
  ".pdf": "PDF",
  ".docx": "DOCX",
  ".doc": "DOCX",
  ".xlsx": "XLSX",
  ".xls": "XLSX",
  ".png": "PNG",
  ".jpg": "JPG",
  ".jpeg": "JPG",
  ".zip": "ZIP",
};

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function detectFileType(fileName: string, mimeType: string): DocumentFileType {
  const ext = extname(fileName).toLowerCase();
  if (EXT_TO_TYPE[ext]) return EXT_TO_TYPE[ext];
  if (mimeType.includes("pdf")) return "PDF";
  if (mimeType.includes("word")) return "DOCX";
  if (mimeType.includes("sheet") || mimeType.includes("excel")) return "XLSX";
  if (mimeType.includes("png")) return "PNG";
  if (mimeType.includes("jpeg") || mimeType.includes("jpg")) return "JPG";
  if (mimeType.includes("zip")) return "ZIP";
  return "OTHER";
}
