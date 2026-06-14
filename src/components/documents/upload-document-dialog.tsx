"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X, FileUp, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SelectField } from "@/components/ui/select-field";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DEPARTMENT_LABELS, DOCUMENT_TAGS } from "@/lib/documents/constants";
import type { DocumentDepartment } from "@prisma/client";

type FolderOption = { id: string; name: string; department: DocumentDepartment };

export function UploadDocumentDialog({
  folders,
  defaultDepartment,
  size = "default",
}: {
  folders: FolderOption[];
  defaultDepartment?: DocumentDepartment;
  size?: "default" | "sm";
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [department, setDepartment] = useState<DocumentDepartment>(
    defaultDepartment ?? "COMPANY_LEGAL",
  );

  const filteredFolders = folders.filter((f) => f.department === department);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const dropped = Array.from(e.dataTransfer.files);
    setFiles((prev) => [...prev, ...dropped]);
  }, []);

  const uploadFiles = async (form: HTMLFormElement) => {
    if (files.length === 0) {
      toast.error("Select at least one file.");
      return;
    }

    setUploading(true);
    setProgress(0);

    const fdBase = new FormData(form);
    let completed = 0;

    for (const file of files) {
      const fd = new FormData();
      fd.set("file", file);
      fd.set("title", String(fdBase.get("title") || file.name));
      fd.set("department", department);
      fd.set("folderId", String(fdBase.get("folderId") || ""));
      fd.set("classification", String(fdBase.get("classification") || "INTERNAL"));
      fd.set("tags", String(fdBase.get("tags") || ""));
      fd.set("description", String(fdBase.get("description") || ""));
      fd.set("expiryDate", String(fdBase.get("expiryDate") || ""));
      fd.set("employeeRef", String(fdBase.get("employeeRef") || ""));
      fd.set("documentType", String(fdBase.get("documentType") || ""));

      const res = await fetch("/api/documents/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? `Failed to upload ${file.name}`);
        setUploading(false);
        return;
      }
      completed += 1;
      setProgress(Math.round((completed / files.length) * 100));
    }

    toast.success(files.length > 1 ? `${files.length} documents uploaded` : "Document uploaded");
    setFiles([]);
    form.reset();
    setOpen(false);
    setUploading(false);
    setProgress(0);
    router.refresh();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size={size}>
          <Upload className="h-4 w-4" />
          Upload
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Upload documents</DialogTitle>
          <DialogDescription>
            Drag & drop PDF, DOCX, XLSX, PNG, JPG, or ZIP — up to 25 MB each.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            await uploadFiles(e.currentTarget);
          }}
        >
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className="flex min-h-[140px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 text-center transition hover:border-primary/50 hover:bg-muted/50"
            onClick={() => document.getElementById("vault-file-input")?.click()}
          >
            <FileUp className="mb-2 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Drop files here or click to browse</p>
            <p className="mt-1 text-xs text-muted-foreground">Multi-file upload supported</p>
            <input
              id="vault-file-input"
              type="file"
              multiple
              className="hidden"
              accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg,.zip"
              onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
            />
          </div>

          {files.length > 0 && (
            <ul className="space-y-2 rounded-lg border border-border/60 p-3">
              {files.map((f) => (
                <li key={`${f.name}-${f.size}`} className="flex items-center justify-between text-sm">
                  <span className="truncate">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((prev) => prev.filter((x) => x !== f))}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {uploading && (
            <div className="space-y-1">
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-muted-foreground">Uploading… {progress}%</p>
            </div>
          )}

          <div>
            <Label htmlFor="doc-title">Title</Label>
            <Input
              id="doc-title"
              name="title"
              placeholder="Defaults to file name"
              className="mt-1.5"
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="doc-dept">Department</Label>
              <select
                id="doc-dept"
                value={department}
                onChange={(e) => setDepartment(e.target.value as DocumentDepartment)}
                className="mt-1.5 flex h-10 w-full rounded-lg border border-input bg-background px-3 text-sm"
              >
                {Object.entries(DEPARTMENT_LABELS).map(([key, label]) => (
                  <option key={key} value={key}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
            <SelectField label="Folder" name="folderId">
              <option value="">Auto / none</option>
              {filteredFolders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </SelectField>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Classification" name="classification">
              <option value="INTERNAL">Internal</option>
              <option value="CONFIDENTIAL">Confidential</option>
              <option value="PUBLIC">Public</option>
            </SelectField>
            <div>
              <Label htmlFor="doc-expiry">Expiry date</Label>
              <Input id="doc-expiry" name="expiryDate" type="date" className="mt-1.5" />
            </div>
          </div>

          <div>
            <Label htmlFor="doc-tags">Tags (comma separated)</Label>
            <Input
              id="doc-tags"
              name="tags"
              placeholder={DOCUMENT_TAGS.slice(0, 3).join(", ")}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="doc-desc">Description</Label>
            <Textarea id="doc-desc" name="description" rows={2} className="mt-1.5" />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Uploading…
                </>
              ) : (
                "Upload documents"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
