import { randomUUID } from "crypto";
import { auth } from "@/auth";
import { finalizeDocumentUpload } from "@/actions/documents";
import { canUploadDocuments, canAccessDepartment } from "@/lib/documents/permissions";
import { saveDocumentFile, deleteDocumentFile } from "@/lib/documents/storage";
import type { DocumentDepartment } from "@prisma/client";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = session.user.role;
  if (!canUploadDocuments(role)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await request.formData();
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return Response.json({ error: "No file provided." }, { status: 400 });
  }

  const department = String(formData.get("department") ?? "") as DocumentDepartment;
  if (!canAccessDepartment(role, department)) {
    return Response.json({ error: "Department access denied." }, { status: 403 });
  }

  const documentId = randomUUID();

  try {
    const saved = await saveDocumentFile(documentId, file);
    const tags = String(formData.get("tags") ?? "")
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const result = await finalizeDocumentUpload(
      documentId,
      {
        title: String(formData.get("title") ?? file.name),
        department,
        folderId: String(formData.get("folderId") ?? "") || undefined,
        classification: (String(formData.get("classification") ?? "INTERNAL") ||
          "INTERNAL") as "PUBLIC" | "INTERNAL" | "CONFIDENTIAL",
        tags,
        description: String(formData.get("description") ?? "") || undefined,
        expiryDate: String(formData.get("expiryDate") ?? "") || undefined,
        employeeRef: String(formData.get("employeeRef") ?? "") || undefined,
        documentType: String(formData.get("documentType") ?? "") || undefined,
      },
      saved,
    );

    if (!result.ok) {
      await deleteDocumentFile(saved.fileUrl);
      return Response.json({ error: result.error }, { status: 400 });
    }

    return Response.json({ ok: true, id: result.data.id, fileUrl: saved.fileUrl });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return Response.json({ error: message }, { status: 400 });
  }
}
