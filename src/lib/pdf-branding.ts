import type { CompanyProfile } from "@prisma/client";
import type jsPDF from "jspdf";
import { dataUrlImageFormat, drawRoundBrandLogo, loadInvoiceLogoDataUrl } from "@/lib/pdf-logo";

export async function loadLogoDataUrl(logoUrl: string | null | undefined): Promise<string | null> {
  return loadInvoiceLogoDataUrl(logoUrl);
}

export async function applyPdfLetterhead(doc: jsPDF, company: CompanyProfile | null) {
  const logo = await loadLogoDataUrl(company?.logoUrl);
  let y = 14;

  if (logo) {
    try {
      const d = 28;
      drawRoundBrandLogo(doc, logo, dataUrlImageFormat(logo), 14 + d / 2, 10 + d / 2, d);
      y = 42;
    } catch {
      y = 14;
    }
  }

  const name = company?.legalName || company?.name || "Dandakaranya Foods";
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text(name, 14, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  let lineY = y + 6;
  if (company?.tagline) {
    doc.text(company.tagline, 14, lineY);
    lineY += 5;
  }
  if (company?.address) {
    doc.text(company.address, 14, lineY);
    lineY += 5;
  }
  const contact = [company?.phone, company?.email].filter(Boolean).join(" · ");
  if (contact) {
    doc.text(contact, 14, lineY);
    lineY += 5;
  }
  if (company?.gstin) {
    doc.text(`GSTIN: ${company.gstin}`, 14, lineY);
    lineY += 5;
  }
  if (company?.website) {
    doc.text(company.website, 14, lineY);
    lineY += 5;
  }

  doc.setDrawColor(180, 140, 60);
  doc.setLineWidth(0.4);
  doc.line(14, lineY + 2, 196, lineY + 2);

  return lineY + 10;
}
