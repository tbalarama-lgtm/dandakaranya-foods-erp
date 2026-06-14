import { Suspense } from "react";
import type { DocumentDepartment, DocumentFileType } from "@prisma/client";
import { DocumentsPageHeader } from "@/components/documents/documents-page-header";
import { DocumentListClient } from "@/components/documents/document-list-client";
import { DocumentSearchBar } from "@/components/documents/document-search-bar";
import { UploadDocumentDialog } from "@/components/documents/upload-document-dialog";
import { canUploadDocuments } from "@/lib/documents/permissions";
import { listDocuments } from "@/lib/documents/queries";
import { getVaultFolders, requireVaultAccess } from "@/lib/documents/page-data";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{
  q?: string;
  department?: string;
  type?: string;
  tag?: string;
  starred?: string;
  confidential?: string;
}>;

export default async function AllDocumentsPage({ searchParams }: { searchParams: SearchParams }) {
  const user = await requireVaultAccess();
  const params = await searchParams;
  const folders = await getVaultFolders();

  const documents = await listDocuments({
    role: user.role,
    q: params.q,
    department: params.department as DocumentDepartment | undefined,
    fileType: params.type as DocumentFileType | undefined,
    tag: params.tag,
    starredOnly: params.starred === "1",
    confidentialOnly: params.confidential === "1",
  });

  return (
    <>
      <DocumentsPageHeader
        title="All documents"
        description="Search and filter across your authorized departments."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Suspense>
              <DocumentSearchBar />
            </Suspense>
            {canUploadDocuments(user.role) && <UploadDocumentDialog folders={folders} size="sm" />}
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2 text-sm">
        {["PDF", "DOCX", "XLSX", "PNG", "JPG"].map((t) => (
          <a
            key={t}
            href={`?type=${t}`}
            className="rounded-full border border-border px-3 py-1 hover:bg-muted"
          >
            {t}
          </a>
        ))}
        <a href="?confidential=1" className="rounded-full border border-destructive/30 px-3 py-1 text-destructive hover:bg-destructive/5">
          Confidential
        </a>
        <a href="?starred=1" className="rounded-full border border-border px-3 py-1 hover:bg-muted">
          Starred
        </a>
      </div>

      <DocumentListClient documents={documents} />
    </>
  );
}
