import { DocumentsPageHeader } from "@/components/documents/documents-page-header";
import { DocumentListClient } from "@/components/documents/document-list-client";
import { listDocuments } from "@/lib/documents/queries";
import { requireVaultAccess } from "@/lib/documents/page-data";

export const dynamic = "force-dynamic";

export default async function TrashPage() {
  const user = await requireVaultAccess();
  const documents = await listDocuments({ role: user.role, includeTrash: true });

  return (
    <>
      <DocumentsPageHeader
        title="Trash"
        description="Deleted documents — restore or permanently remove."
      />
      <DocumentListClient documents={documents} />
    </>
  );
}
