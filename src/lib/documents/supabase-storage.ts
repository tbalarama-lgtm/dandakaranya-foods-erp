import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { DOCUMENT_VAULT_BUCKET, parseSupabaseStorageKey } from "./file-url";

export async function uploadToSupabaseStorage(
  storageKey: string,
  buffer: Buffer,
  mimeType: string,
) {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Supabase Storage is not configured.");

  const { error } = await supabase.storage.from(DOCUMENT_VAULT_BUCKET).upload(storageKey, buffer, {
    contentType: mimeType,
    upsert: false,
  });

  if (error) throw new Error(error.message);
}

export async function downloadFromSupabaseStorage(storageKey: string) {
  const supabase = createAdminClient();
  if (!supabase) throw new Error("Supabase Storage is not configured.");

  const { data, error } = await supabase.storage.from(DOCUMENT_VAULT_BUCKET).download(storageKey);
  if (error || !data) throw new Error(error?.message ?? "File not found in storage.");

  return Buffer.from(await data.arrayBuffer());
}

export async function deleteFromSupabaseStorage(fileUrl: string) {
  const key = parseSupabaseStorageKey(fileUrl);
  if (!key) return;

  const supabase = createAdminClient();
  if (!supabase) return;

  await supabase.storage.from(DOCUMENT_VAULT_BUCKET).remove([key]);
}

export async function createSupabaseSignedUrl(fileUrl: string, expiresInSeconds = 3600) {
  const key = parseSupabaseStorageKey(fileUrl);
  if (!key) return null;

  const supabase = createAdminClient();
  if (!supabase) return null;

  const { data, error } = await supabase.storage
    .from(DOCUMENT_VAULT_BUCKET)
    .createSignedUrl(key, expiresInSeconds);

  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}
