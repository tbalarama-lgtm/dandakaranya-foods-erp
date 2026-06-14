"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { format } from "date-fns";
import {
  Download,
  Share2,
  Archive,
  Trash2,
  Star,
  Send,
  CheckCircle2,
  XCircle,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";
import {
  addDocumentComment,
  createShareLink,
  moveDocumentToTrash,
  renameDocument,
  toggleDocumentStar,
  updateDocumentWorkflow,
} from "@/actions/documents";
import { DEPARTMENT_LABELS, WORKFLOW_LABELS } from "@/lib/documents/constants";
import { formatFileSize } from "@/lib/documents/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { DocumentClassification, DocumentDepartment, DocumentWorkflowStatus } from "@prisma/client";

type DocumentDetail = {
  id: string;
  title: string;
  fileName: string;
  fileUrl: string;
  mimeType: string;
  fileType: string;
  sizeBytes: number;
  department: DocumentDepartment;
  classification: DocumentClassification;
  workflowStatus: DocumentWorkflowStatus;
  tags: string[];
  description: string | null;
  expiryDate: Date | null;
  employeeRef: string | null;
  documentType: string | null;
  internalNotes: string | null;
  isStarred: boolean;
  isShared: boolean;
  sharedLinkToken: string | null;
  sharedLinkExpiry: Date | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  uploadedBy: { name: string; email: string };
  approvedBy: { name: string } | null;
  approvedAt: Date | null;
  folder: { name: string; path: string } | null;
  versions: {
    id: string;
    version: number;
    fileName: string;
    createdAt: Date;
    changeNotes: string | null;
    uploadedBy: { name: string };
  }[];
  comments: {
    id: string;
    body: string;
    createdAt: Date;
    user: { name: string };
  }[];
  downloads: {
    id: string;
    createdAt: Date;
    user: { name: string };
  }[];
};

export function DocumentDetailClient({
  document,
  canManage,
  canApprove,
  canDelete,
}: {
  document: DocumentDetail;
  canManage: boolean;
  canApprove: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [comment, setComment] = useState("");
  const [title, setTitle] = useState(document.title);
  const [shareUrl, setShareUrl] = useState<string | null>(
    document.sharedLinkToken
      ? `${typeof window !== "undefined" ? window.location.origin : ""}/documents/shared/${document.sharedLinkToken}`
      : null,
  );

  const isPreviewable =
    document.mimeType.startsWith("image/") || document.mimeType === "application/pdf";
  const previewUrl = `/api/documents/${document.id}/preview`;

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
          {isPreviewable ? (
            document.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={document.title} className="max-h-[480px] w-full object-contain bg-muted/30" />
            ) : (
              <iframe
                src={previewUrl}
                title={document.title}
                className="h-[480px] w-full bg-muted/20"
              />
            )
          ) : (
            <div className="flex h-48 flex-col items-center justify-center bg-muted/30 p-6 text-center">
              <p className="font-medium">Preview not available</p>
              <p className="mt-1 text-sm text-muted-foreground">{document.fileType} · Download to view</p>
            </div>
          )}
          {document.classification === "CONFIDENTIAL" && (
            <div className="border-t border-destructive/20 bg-destructive/5 px-4 py-2 text-center text-xs font-semibold uppercase tracking-wider text-destructive">
              Confidential — download watermarked
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="font-semibold">Version history</h2>
          <ul className="mt-3 space-y-2">
            {document.versions.map((v) => (
              <li key={v.id} className="flex items-start justify-between rounded-lg border border-border/50 p-3 text-sm">
                <div>
                  <p className="font-medium">v{v.version} — {v.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {v.uploadedBy.name} · {format(new Date(v.createdAt), "dd MMM yyyy HH:mm")}
                  </p>
                  {v.changeNotes && <p className="mt-1 text-xs">{v.changeNotes}</p>}
                </div>
                {v.version === document.version && (
                  <Badge variant="success">Current</Badge>
                )}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h2 className="flex items-center gap-2 font-semibold">
            <MessageSquare className="h-4 w-4" />
            Comments
          </h2>
          <ul className="mt-3 space-y-3">
            {document.comments.length === 0 && (
              <p className="text-sm text-muted-foreground">No comments yet.</p>
            )}
            {document.comments.map((c) => (
              <li key={c.id} className="rounded-lg bg-muted/40 p-3 text-sm">
                <p className="font-medium">{c.user.name}</p>
                <p className="mt-1">{c.body}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {format(new Date(c.createdAt), "dd MMM yyyy HH:mm")}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex gap-2">
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add internal note or approval comment…"
              rows={2}
              className="flex-1"
            />
            <Button
              type="button"
              onClick={async () => {
                const res = await addDocumentComment(document.id, comment);
                if (res.ok) {
                  setComment("");
                  router.refresh();
                } else toast.error(res.error);
              }}
            >
              Post
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="rounded-xl border border-border/60 bg-card/80 p-5 backdrop-blur-md">
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm">
              <a href={`/api/documents/${document.id}/download`}>
                <Download className="h-4 w-4" />
                Download
              </a>
            </Button>
            {canManage && (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const res = await createShareLink(document.id);
                  if (res.ok) {
                    const url = `${window.location.origin}/documents/shared/${res.data.token}`;
                    setShareUrl(url);
                    toast.success("Share link created (7 days)");
                  } else toast.error(res.error);
                }}
              >
                <Share2 className="h-4 w-4" />
                Share
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const res = await toggleDocumentStar(document.id);
                if (res.ok) router.refresh();
              }}
            >
              <Star className={`h-4 w-4 ${document.isStarred ? "fill-gold-500 text-gold-500" : ""}`} />
            </Button>
          </div>

          {shareUrl && (
            <p className="mt-3 break-all rounded-lg bg-muted p-2 text-xs">{shareUrl}</p>
          )}

          <div className="mt-4 space-y-3 text-sm">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Status</p>
              <Badge className="mt-1">{WORKFLOW_LABELS[document.workflowStatus]}</Badge>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Department</p>
              <p className="mt-1 font-medium">{DEPARTMENT_LABELS[document.department]}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Folder</p>
              <p className="mt-1">{document.folder?.name ?? "—"}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Uploaded by</p>
              <p className="mt-1">{document.uploadedBy.name}</p>
              <p className="text-xs text-muted-foreground">
                {format(new Date(document.createdAt), "dd MMM yyyy HH:mm")}
              </p>
            </div>
            {document.expiryDate && (
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Expiry</p>
                <p className="mt-1 font-medium text-amber-600">
                  {format(new Date(document.expiryDate), "dd MMM yyyy")}
                </p>
              </div>
            )}
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">File size</p>
              <p className="mt-1">{formatFileSize(document.sizeBytes)} · v{document.version}</p>
            </div>
            {document.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {document.tags.map((t) => (
                  <Badge key={t} variant="muted">
                    {t}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          {canManage && (
            <div className="mt-4 space-y-2 border-t border-border pt-4">
              <LabelRename title={title} setTitle={setTitle} documentId={document.id} router={router} />
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-4">
            {document.workflowStatus === "DRAFT" && canManage && (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const res = await updateDocumentWorkflow(document.id, "UNDER_REVIEW");
                  if (res.ok) router.refresh();
                  else toast.error(res.error);
                }}
              >
                <Send className="h-4 w-4" />
                Submit for review
              </Button>
            )}
            {document.workflowStatus === "UNDER_REVIEW" && canApprove && (
              <>
                <Button
                  size="sm"
                  onClick={async () => {
                    const res = await updateDocumentWorkflow(document.id, "APPROVED");
                    if (res.ok) router.refresh();
                    else toast.error(res.error);
                  }}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Approve
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={async () => {
                    const res = await updateDocumentWorkflow(document.id, "REJECTED", "Rejected by reviewer");
                    if (res.ok) router.refresh();
                    else toast.error(res.error);
                  }}
                >
                  <XCircle className="h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
            {canManage && document.workflowStatus === "APPROVED" && (
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const res = await updateDocumentWorkflow(document.id, "ARCHIVED");
                  if (res.ok) router.refresh();
                  else toast.error(res.error);
                }}
              >
                <Archive className="h-4 w-4" />
                Archive
              </Button>
            )}
            {canDelete && (
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!confirm("Move this document to trash?")) return;
                  const res = await moveDocumentToTrash(document.id);
                  if (res.ok) router.push("/documents/trash");
                  else toast.error(res.error);
                }}
              >
                <Trash2 className="h-4 w-4" />
                Delete
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-border/60 bg-card p-5">
          <h3 className="text-sm font-semibold">Download audit</h3>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {document.downloads.slice(0, 5).map((d) => (
              <li key={d.id}>
                {d.user.name} · {format(new Date(d.createdAt), "dd MMM HH:mm")}
              </li>
            ))}
            {document.downloads.length === 0 && <li>No downloads logged</li>}
          </ul>
        </div>

        <div className="rounded-xl border border-dashed border-border/60 bg-muted/20 p-4 text-xs text-muted-foreground">
          <p className="font-medium text-foreground">AI-ready architecture</p>
          <p className="mt-1">OCR extraction, smart tagging, duplicate detection, and AI summarization hooks are reserved for future integration.</p>
        </div>
      </div>
    </div>
  );
}

function LabelRename({
  title,
  setTitle,
  documentId,
  router,
}: {
  title: string;
  setTitle: (v: string) => void;
  documentId: string;
  router: ReturnType<typeof useRouter>;
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium">Rename</p>
      <div className="flex gap-2">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-9" />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={async () => {
            const res = await renameDocument(documentId, title);
            if (res.ok) {
              toast.success("Renamed");
              router.refresh();
            } else toast.error(res.error);
          }}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
