import { DocumentsPageHeader } from "@/components/documents/documents-page-header";
import { DocumentListClient } from "@/components/documents/document-list-client";
import { listDocuments } from "@/lib/documents/queries";
import { requireVaultAccess } from "@/lib/documents/page-data";

export const dynamic = "force-dynamic";

export default async function SharedDocumentsPage() {
  const user = await requireVaultAccess();
  const documents = await listDocuments({ role: user.role, sharedOnly: true });

  return (
    <>
      <DocumentsPageHeader
        title="Shared files"
        description="Documents shared via secure links with expiry."
      />
      <DocumentListClient documents={documents} />
    </>
  );
}
