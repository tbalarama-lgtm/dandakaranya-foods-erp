import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import {
  ALLOWED_RESUME_TYPES,
  MAX_RESUME_BYTES,
  RESUME_UPLOAD_DIR,
  getResumeMeta,
  saveResumeMeta,
} from "@/lib/hr/recruitment-resumes";

export const runtime = "nodejs";

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "resume";
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || !can(session.user.role, "hr.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const meta = await getResumeMeta(id);
    if (!meta) return NextResponse.json({ error: "No resume on file" }, { status: 404 });

    return NextResponse.json(meta);
  } catch (err) {
    console.error("[resume-get]", err);
    return NextResponse.json({ error: "Failed to load resume" }, { status: 500 });
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || !can(session.user.role, "hr.view")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_RESUME_BYTES) {
      return NextResponse.json({ error: "File must be 5 MB or smaller" }, { status: 400 });
    }

    const type = file.type || "application/octet-stream";
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const extOk = ["pdf", "doc", "docx"].includes(ext);
    if (!ALLOWED_RESUME_TYPES.has(type) && !extOk) {
      return NextResponse.json(
        { error: "Only PDF, DOC, or DOCX files are allowed" },
        { status: 400 },
      );
    }

    const bytes = Buffer.from(await file.arrayBuffer());
    await mkdir(RESUME_UPLOAD_DIR, { recursive: true });

    const storedName = `${id}-${Date.now()}-${safeFileName(file.name)}`;
    const diskPath = join(RESUME_UPLOAD_DIR, storedName);
    await writeFile(diskPath, bytes);

    const resumeUrl = `/uploads/resumes/${storedName}`;
    const meta = {
      resumeUrl,
      resumeFileName: file.name,
      uploadedAt: new Date().toISOString(),
    };
    await saveResumeMeta(id, meta);

    return NextResponse.json(meta);
  } catch (err) {
    console.error("[resume-upload]", err);
    return NextResponse.json(
      {
        error: "Failed to upload resume",
        detail: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
