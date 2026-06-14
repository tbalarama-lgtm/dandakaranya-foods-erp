export const DOCUMENT_VAULT_BUCKET = "document-vault";

const SUPABASE_PREFIX = `sb://${DOCUMENT_VAULT_BUCKET}/`;

export function toSupabaseFileUrl(storageKey: string) {
  return `${SUPABASE_PREFIX}${storageKey}`;
}

export function isSupabaseFileUrl(fileUrl: string) {
  return fileUrl.startsWith(SUPABASE_PREFIX);
}

export function isLocalFileUrl(fileUrl: string) {
  return fileUrl.startsWith("/uploads/");
}

export function parseSupabaseStorageKey(fileUrl: string) {
  if (!isSupabaseFileUrl(fileUrl)) return null;
  return fileUrl.slice(SUPABASE_PREFIX.length);
}
