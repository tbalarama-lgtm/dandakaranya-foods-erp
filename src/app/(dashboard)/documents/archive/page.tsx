import { DocumentsPageHeader } from "@/components/documents/documents-page-header";
import { DocumentListClient } from "@/components/documents/document-list-client";
import { listDocuments } from "@/lib/documents/queries";
import { requireVaultAccess } from "@/lib/documents/page-data";

export const dynamic = "force-dynamic";

export default async function ArchivePage() {
  const user = await requireVaultAccess();
  const documents = await listDocuments({ role: user.role, archivedOnly: true });

  return (
    <>
      <DocumentsPageHeader
        title="Archive"
        description="Approved documents moved to long-term archive."
      />
      <DocumentListClient documents={documents} />
    </>
  );
}
