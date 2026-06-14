"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Star, Download, Shield, Clock } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { toggleDocumentStar } from "@/actions/documents";
import { DEPARTMENT_LABELS, WORKFLOW_LABELS } from "@/lib/documents/constants";
import { formatFileSize } from "@/lib/documents/format";
import { Badge } from "@/components/ui/badge";
import {
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
} from "@/components/shared/data-table";
import type { DocumentDepartment, DocumentFileType, DocumentWorkflowStatus } from "@prisma/client";
import { toast } from "sonner";

export type DocumentRow = {
  id: string;
  title: string;
  fileName: string;
  fileType: DocumentFileType;
  sizeBytes: number;
  department: DocumentDepartment;
  workflowStatus: DocumentWorkflowStatus;
  classification: string;
  tags: string[];
  expiryDate: Date | null;
  isStarred: boolean;
  isShared: boolean;
  createdAt: Date;
  uploadedBy: { name: string };
  folder: { name: string } | null;
  _count: { downloads: number };
};

const statusVariant: Record<string, "default" | "muted" | "success" | "warning" | "danger"> = {
  DRAFT: "muted",
  UNDER_REVIEW: "warning",
  APPROVED: "success",
  ARCHIVED: "default",
  REJECTED: "danger",
};

export function DocumentListClient({ documents }: { documents: DocumentRow[] }) {
  const router = useRouter();

  if (documents.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-card/50 p-12 text-center">
        <p className="font-medium">No documents found</p>
        <p className="mt-1 text-sm text-muted-foreground">Upload files or adjust your filters.</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden md:block">
        <DataTableShell>
          <DataTableHead>
            <tr>
              <DataTableHeaderCell>Document</DataTableHeaderCell>
              <DataTableHeaderCell>Department</DataTableHeaderCell>
              <DataTableHeaderCell>Folder</DataTableHeaderCell>
              <DataTableHeaderCell>Status</DataTableHeaderCell>
              <DataTableHeaderCell>Size</DataTableHeaderCell>
              <DataTableHeaderCell>Uploaded</DataTableHeaderCell>
              <DataTableHeaderCell className="text-right">Actions</DataTableHeaderCell>
            </tr>
          </DataTableHead>
          <DataTableBody>
            {documents.map((doc) => (
              <DataTableRow key={doc.id}>
                <DataTableCell>
                  <Link href={`/documents/${doc.id}`} className="font-medium hover:text-primary">
                    {doc.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">{doc.fileName}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {doc.classification === "CONFIDENTIAL" && (
                      <Badge variant="danger" className="text-[10px]">
                        <Shield className="mr-1 h-3 w-3" />
                        Confidential
                      </Badge>
                    )}
                    {doc.expiryDate && new Date(doc.expiryDate) < new Date(Date.now() + 30 * 86400000) && (
                      <Badge variant="warning" className="text-[10px]">
                        <Clock className="mr-1 h-3 w-3" />
                        Expiring
                      </Badge>
                    )}
                  </div>
                </DataTableCell>
                <DataTableCell className="text-sm">{DEPARTMENT_LABELS[doc.department]}</DataTableCell>
                <DataTableCell className="text-sm text-muted-foreground">
                  {doc.folder?.name ?? "—"}
                </DataTableCell>
                <DataTableCell>
                  <Badge variant={statusVariant[doc.workflowStatus] ?? "muted"}>
                    {WORKFLOW_LABELS[doc.workflowStatus]}
                  </Badge>
                </DataTableCell>
                <DataTableCell className="text-sm">{formatFileSize(doc.sizeBytes)}</DataTableCell>
                <DataTableCell className="text-sm text-muted-foreground">
                  {doc.uploadedBy.name}
                  <br />
                  <span className="text-xs">
                    {formatDistanceToNow(new Date(doc.createdAt), { addSuffix: true })}
                  </span>
                </DataTableCell>
                <DataTableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <button
                      type="button"
                      className="rounded-lg p-2 hover:bg-muted"
                      onClick={async () => {
                        const res = await toggleDocumentStar(doc.id);
                        if (res.ok) router.refresh();
                        else toast.error(res.error);
                      }}
                    >
                      <Star
                        className={`h-4 w-4 ${doc.isStarred ? "fill-gold-500 text-gold-500" : "text-muted-foreground"}`}
                      />
                    </button>
                    <a
                      href={`/api/documents/${doc.id}/download`}
                      className="rounded-lg p-2 hover:bg-muted"
                    >
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </a>
                  </div>
                </DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTableShell>
      </div>

      <div className="grid gap-3 md:hidden">
        {documents.map((doc) => (
          <Link
            key={doc.id}
            href={`/documents/${doc.id}`}
            className="rounded-xl border border-border/60 bg-card p-4"
          >
            <p className="font-medium">{doc.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {DEPARTMENT_LABELS[doc.department]} · {formatFileSize(doc.sizeBytes)}
            </p>
            {doc.expiryDate && (
              <p className="mt-1 text-xs text-amber-600">
                Expires {format(new Date(doc.expiryDate), "dd MMM yyyy")}
              </p>
            )}
          </Link>
        ))}
      </div>
    </>
  );
}
