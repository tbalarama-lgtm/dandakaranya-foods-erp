import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { getDocumentFileBuffer } from "@/lib/documents/file-access";
import { canAccessDepartment } from "@/lib/documents/permissions";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const doc = await prisma.document.findUnique({ where: { id } });
  if (!doc || doc.deletedAt) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (!canAccessDepartment(session.user.role, doc.department)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const buffer = await getDocumentFileBuffer(doc.fileUrl);
    const headers = new Headers();
    headers.set("Content-Type", doc.mimeType);
    headers.set("Content-Disposition", `inline; filename="${doc.fileName}"`);
    headers.set("Cache-Control", "private, max-age=300");
    if (doc.classification === "CONFIDENTIAL") {
      headers.set("X-Document-Watermark", "CONFIDENTIAL — Dandakaranya Foods");
    }
    return new Response(buffer, { headers });
  } catch {
    return Response.json({ error: "File missing in storage." }, { status: 404 });
  }
}
