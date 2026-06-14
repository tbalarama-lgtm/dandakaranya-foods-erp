import { DocumentsPageHeader } from "@/components/documents/documents-page-header";
import { DocumentListClient } from "@/components/documents/document-list-client";
import { listDocuments } from "@/lib/documents/queries";
import { requireVaultAccess } from "@/lib/documents/page-data";

export const dynamic = "force-dynamic";

export default async function ExpiringDocumentsPage() {
  const user = await requireVaultAccess();
  const documents = await listDocuments({ role: user.role, expiringOnly: true });

  return (
    <>
      <DocumentsPageHeader
        title="Expiring soon"
        description="Compliance alerts for FSSAI, GST, vendor contracts, and employee documents — renewals due within 30 days."
      />
      <DocumentListClient documents={documents} />
    </>
  );
}
