import { DocumentsPageHeader } from "@/components/documents/documents-page-header";
import { DocumentListClient } from "@/components/documents/document-list-client";
import { listDocuments } from "@/lib/documents/queries";
import { requireVaultAccess } from "@/lib/documents/page-data";

export const dynamic = "force-dynamic";

export default async function ApprovalsPage() {
  const user = await requireVaultAccess();
  const documents = await listDocuments({
    role: user.role,
    workflowStatus: "UNDER_REVIEW",
  });

  return (
    <>
      <DocumentsPageHeader
        title="Pending approvals"
        description="Documents awaiting review — Draft → Under Review → Approved → Archived."
      />
      <DocumentListClient documents={documents} />
    </>
  );
}
