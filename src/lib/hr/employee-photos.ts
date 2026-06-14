import { mkdir, writeFile } from "fs/promises";
import { join } from "path";

export const PHOTO_UPLOAD_DIR = join(process.cwd(), "public", "uploads", "employees");

export const ALLOWED_PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);

export const MAX_PHOTO_BYTES = 2 * 1024 * 1024;

function safeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80) || "photo";
}

export async function saveEmployeePhotoFile(
  employeeId: string,
  file: File,
): Promise<{ photoUrl: string }> {
  if (file.size > MAX_PHOTO_BYTES) {
    throw new Error("Photo must be 2 MB or smaller");
  }

  const type = file.type || "application/octet-stream";
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  const extOk = ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
  if (!ALLOWED_PHOTO_TYPES.has(type) && !extOk) {
    throw new Error("Only JPG, PNG, WebP, or GIF images are allowed");
  }

  const bytes = Buffer.from(await file.arrayBuffer());
  await mkdir(PHOTO_UPLOAD_DIR, { recursive: true });

  const storedName = `${employeeId}-${Date.now()}-${safeFileName(file.name)}`;
  const diskPath = join(PHOTO_UPLOAD_DIR, storedName);
  await writeFile(diskPath, bytes);

  return { photoUrl: `/uploads/employees/${storedName}` };
}
