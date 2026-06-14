import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { DocumentsPageHeader } from "@/components/documents/documents-page-header";
import { DocumentDetailClient } from "@/components/documents/document-detail-client";
import {
  canAccessDepartment,
  canApproveDocuments,
  canDeleteDocuments,
  canManageDocuments,
} from "@/lib/documents/permissions";
import { getDocumentById } from "@/lib/documents/queries";
import { requireVaultAccess } from "@/lib/documents/page-data";

export const dynamic = "force-dynamic";

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireVaultAccess();
  const { id } = await params;
  const document = await getDocumentById(id);

  if (!document) notFound();
  if (!canAccessDepartment(user.role, document.department)) redirect("/documents");

  return (
    <>
      <Link
        href="/documents/all"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to documents
      </Link>
      <DocumentsPageHeader title={document.title} description={document.fileName} />
      <DocumentDetailClient
        document={document}
        canManage={canManageDocuments(user.role)}
        canApprove={canApproveDocuments(user.role)}
        canDelete={canDeleteDocuments(user.role)}
      />
    </>
  );
}
