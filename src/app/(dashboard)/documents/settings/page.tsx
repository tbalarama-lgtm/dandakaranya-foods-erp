import { DocumentsPageHeader } from "@/components/documents/documents-page-header";
import { PermissionMatrix } from "@/components/documents/permission-matrix";
import { DOCUMENT_TAGS } from "@/lib/documents/constants";
import { getStorageMode } from "@/lib/documents/storage";
import { isSupabaseStorageEnabled } from "@/lib/supabase/admin";
import { requireVaultAccess } from "@/lib/documents/page-data";

export const dynamic = "force-dynamic";

export default async function DocumentsSettingsPage() {
  await requireVaultAccess();
  const storageMode = getStorageMode();
  const supabaseReady = isSupabaseStorageEnabled();

  return (
    <>
      <DocumentsPageHeader
        title="Vault settings"
        description="Permissions, tags, and enterprise configuration."
      />

      <section className="mb-10 rounded-xl border border-border/60 bg-card/80 p-5">
        <h2 className="font-semibold">File storage</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Active mode:{" "}
          <span className="font-medium text-foreground">
            {storageMode === "supabase" ? "Supabase Storage (persistent)" : "Local disk (dev fallback)"}
          </span>
        </p>
        {!supabaseReady && (
          <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <p className="font-medium text-amber-800">Supabase Storage not configured</p>
            <p className="mt-1 text-muted-foreground">
              Set <code className="text-xs">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
              <code className="text-xs">SUPABASE_SERVICE_ROLE_KEY</code> in Vercel env, then run{" "}
              <code className="text-xs">supabase/document-vault-storage.sql</code> in the Supabase SQL editor.
            </p>
          </div>
        )}
        {supabaseReady && (
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>✓ Bucket: <code>document-vault</code> (private)</li>
            <li>✓ Uploads via ERP service role — not publicly accessible</li>
            <li>✓ Preview & download proxied through authenticated API routes</li>
          </ul>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Role permission matrix</h2>
        <PermissionMatrix />
      </section>

      <section className="mt-10 space-y-3">
        <h2 className="text-lg font-semibold">Standard tags</h2>
        <div className="flex flex-wrap gap-2">
          {DOCUMENT_TAGS.map((tag) => (
            <span key={tag} className="rounded-full border border-border bg-card px-3 py-1 text-sm">
              {tag}
            </span>
          ))}
        </div>
      </section>

      <section className="mt-10 rounded-xl border border-border/60 bg-card/80 p-5">
        <h2 className="font-semibold">Enterprise features</h2>
        <ul className="mt-3 grid gap-2 text-sm text-muted-foreground sm:grid-cols-2">
          <li>✓ Version control & audit download logs</li>
          <li>✓ Approval workflow (Draft → Review → Approved → Archive)</li>
          <li>✓ Shared links with expiry</li>
          <li>✓ Department-scoped RBAC</li>
          <li>✓ OCR / AI hooks (architecture ready)</li>
          <li>✓ Supabase Storage for production file persistence</li>
        </ul>
      </section>
    </>
  );
}
