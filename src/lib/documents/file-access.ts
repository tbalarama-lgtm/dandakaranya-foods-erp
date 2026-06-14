import "server-only";

import { readFile } from "fs/promises";
import { join } from "path";
import { isLocalFileUrl, isSupabaseFileUrl, parseSupabaseStorageKey } from "./file-url";
import { downloadFromSupabaseStorage } from "./supabase-storage";

export async function getDocumentFileBuffer(fileUrl: string) {
  if (isSupabaseFileUrl(fileUrl)) {
    const key = parseSupabaseStorageKey(fileUrl);
    if (!key) throw new Error("Invalid storage key.");
    return downloadFromSupabaseStorage(key);
  }

  if (isLocalFileUrl(fileUrl)) {
    const diskPath = join(process.cwd(), "public", fileUrl.replace(/^\//, ""));
    return readFile(diskPath);
  }

  throw new Error("Unsupported file URL.");
}
