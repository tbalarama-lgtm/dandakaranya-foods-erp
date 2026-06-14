/** Normalize and validate a public logo URL for server-side PDF embedding. */
export function normalizeLogoUrl(url: string | undefined | null): string | null {
  const trimmed = url?.trim() ?? "";
  if (!trimmed) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error("Logo URL must be a valid web address.");
  }
  if (parsed.protocol !== "https:") {
    throw new Error("Logo URL must use HTTPS (required for PDF generation).");
  }
  return trimmed;
}
