import { readFile } from "fs/promises";
import { join } from "path";
import type jsPDF from "jspdf";

export function dataUrlImageFormat(dataUrl: string): "PNG" | "JPEG" | "WEBP" {
  if (/data:image\/jpe?g/i.test(dataUrl)) return "JPEG";
  if (/data:image\/webp/i.test(dataUrl)) return "WEBP";
  return "PNG";
}

/**
 * Circular brand mark for PDFs — uses the PNG as-is (no clip/extra ring).
 * The bundled logo is already circular; clipping caused garbled payslip output in jsPDF.
 */
export function drawBrandLogo(
  doc: jsPDF,
  imageData: string,
  format: "PNG" | "JPEG" | "WEBP",
  x: number,
  y: number,
  size: number,
) {
  doc.addImage(imageData, format, x, y, size, size, undefined, "FAST");
}

/** @deprecated Use drawBrandLogo — kept for callers that pass center + diameter. */
export function drawRoundBrandLogo(
  doc: jsPDF,
  imageData: string,
  format: "PNG" | "JPEG" | "WEBP",
  centerX: number,
  centerY: number,
  diameter: number,
) {
  drawBrandLogo(doc, imageData, format, centerX - diameter / 2, centerY - diameter / 2, diameter);
}

/** Read bundled logo from public/ (Node.js runtime only). */
export async function readBundledLogoDataUrl(): Promise<string | null> {
  const candidates = [
    join(process.cwd(), "public", "logo.png"),
    join(process.cwd(), "..", "public", "logo.png"),
  ];
  for (const filePath of candidates) {
    try {
      const buf = await readFile(filePath);
      return `data:image/png;base64,${buf.toString("base64")}`;
    } catch {
      /* try next */
    }
  }
  return null;
}

async function fetchLogoWithTimeout(url: string, ms = 4000): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: { Accept: "image/png,image/jpeg,image/webp,*/*" },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const mime = (res.headers.get("content-type") || "image/png").split(";")[0].trim();
    return `data:${mime};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Prefer local bundled logo; optional remote URL with timeout. */
export async function loadInvoiceLogoDataUrl(logoUrl?: string | null): Promise<string | null> {
  const bundled = await readBundledLogoDataUrl();
  if (bundled) return bundled;
  if (logoUrl?.trim()) return fetchLogoWithTimeout(logoUrl.trim());
  return null;
}
