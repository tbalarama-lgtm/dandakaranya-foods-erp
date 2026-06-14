import { Suspense } from "react";
import { DocumentsPageHeader } from "@/components/documents/documents-page-header";
import { DocumentSearchBar } from "@/components/documents/document-search-bar";
import { UploadDocumentDialog } from "@/components/documents/upload-document-dialog";
import { VaultDashboardClient } from "@/components/documents/vault-dashboard-client";
import { canUploadDocuments } from "@/lib/documents/permissions";
import { getRecentActivity, getVaultMetrics } from "@/lib/documents/queries";
import { getVaultFolders, requireVaultAccess } from "@/lib/documents/page-data";

export const dynamic = "force-dynamic";

export default async function DocumentsDashboardPage() {
  const user = await requireVaultAccess();
  const [metrics, activity, folders] = await Promise.all([
    getVaultMetrics(user.role),
    getRecentActivity(user.role),
    getVaultFolders(),
  ]);

  return (
    <>
      <DocumentsPageHeader
        title="Document vault"
        description="Secure enterprise document management — compliance, approvals, and department-wise organization for Dandakaranya Foods."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Suspense>
              <DocumentSearchBar />
            </Suspense>
            {canUploadDocuments(user.role) && <UploadDocumentDialog folders={folders} />}
          </div>
        }
      />
      <VaultDashboardClient metrics={metrics} activity={activity} />
    </>
  );
}
