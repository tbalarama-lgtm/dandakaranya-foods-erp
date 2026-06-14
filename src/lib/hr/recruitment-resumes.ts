import { readFile, writeFile, mkdir } from "fs/promises";
import { join } from "path";
import type { Candidate } from "@/lib/hr/types";

export type ResumeMeta = {
  resumeUrl: string;
  resumeFileName: string;
  uploadedAt: string;
};

const META_PATH = join(process.cwd(), "data", "recruitment-resumes.json");

async function readMetaMap(): Promise<Record<string, ResumeMeta>> {
  try {
    const raw = await readFile(META_PATH, "utf-8");
    return JSON.parse(raw) as Record<string, ResumeMeta>;
  } catch {
    return {};
  }
}

async function writeMetaMap(map: Record<string, ResumeMeta>) {
  await mkdir(join(process.cwd(), "data"), { recursive: true });
  await writeFile(META_PATH, JSON.stringify(map, null, 2), "utf-8");
}

export async function getResumeMeta(candidateId: string): Promise<ResumeMeta | null> {
  const map = await readMetaMap();
  return map[candidateId] ?? null;
}

export async function saveResumeMeta(candidateId: string, meta: ResumeMeta) {
  const map = await readMetaMap();
  map[candidateId] = meta;
  await writeMetaMap(map);
}

export async function attachResumeMetadata(candidates: Candidate[]): Promise<Candidate[]> {
  const map = await readMetaMap();
  return candidates.map((c) => {
    const meta = map[c.id];
    if (!meta) return c;
    return {
      ...c,
      resumeUrl: meta.resumeUrl,
      resumeFileName: meta.resumeFileName ?? "Resume",
    };
  });
}

export const RESUME_UPLOAD_DIR = join(process.cwd(), "public", "uploads", "resumes");

export const ALLOWED_RESUME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]);

export const MAX_RESUME_BYTES = 5 * 1024 * 1024;
