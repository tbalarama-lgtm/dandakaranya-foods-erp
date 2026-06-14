import type { CompanyProfile } from "@prisma/client";
import jsPDF from "jspdf";
import {
  AADHAAR_CONSENT_PURPOSES,
  AADHAAR_CONSENT_STATEMENT,
  AADHAAR_CONSENT_TITLE,
  type AadhaarConsentFormData,
} from "@/lib/hr/aadhaar-consent";
import { dataUrlImageFormat, drawBrandLogo, loadInvoiceLogoDataUrl } from "@/lib/pdf-logo";
import { PDF_PAGE, PDF_THEME } from "@/lib/pdf-theme";

function splitLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

async function drawLetterhead(doc: jsPDF, company: CompanyProfile | null) {
  const { margin, width } = PDF_PAGE;
  const right = width - margin;
  let y = 18;

  const logo = await loadInvoiceLogoDataUrl(company?.logoUrl);
  const logoSize = 24;
  const textX = logo ? margin + logoSize + 6 : margin;

  if (logo) {
    try {
      drawBrandLogo(doc, logo, dataUrlImageFormat(logo), margin, y - 4, logoSize);
    } catch {
      /* continue */
    }
  }

  const companyName = company?.legalName || company?.name || "Dandakaranya Foods";
  doc.setTextColor(...PDF_THEME.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(companyName, textX, y);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_THEME.muted);
  let detailY = y + 5;
  if (company?.address) {
    for (const line of splitLines(doc, company.address, 115)) {
      doc.text(line, textX, detailY);
      detailY += 3.5;
    }
  }
  const contact = [company?.phone, company?.email].filter(Boolean).join("  |  ");
  if (contact) {
    doc.text(contact, textX, detailY);
    detailY += 3.5;
  }

  y = Math.max(detailY + 6, 42);
  doc.setDrawColor(...PDF_THEME.accent);
  doc.setLineWidth(0.5);
  doc.line(margin, y, right, y);
  return y + 8;
}

function fieldRow(doc: jsPDF, label: string, value: string, y: number, col: "left" | "right") {
  const { margin, contentWidth } = PDF_PAGE;
  const x = col === "left" ? margin : margin + contentWidth / 2 + 4;
  const w = contentWidth / 2 - 4;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(...PDF_THEME.muted);
  doc.text(label.toUpperCase(), x, y);
  doc.setFontSize(9);
  doc.setTextColor(...PDF_THEME.text);
  const lines = splitLines(doc, value || "_________________________", w);
  doc.text(lines, x, y + 4);
  return y + 4 + lines.length * 4.2;
}

export async function buildAadhaarConsentPdf(
  data: AadhaarConsentFormData,
  company: CompanyProfile | null,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const { margin, contentWidth, width } = PDF_PAGE;
  const right = width - margin;

  let y = await drawLetterhead(doc, company);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(...PDF_THEME.primaryDark);
  doc.text(AADHAAR_CONSENT_TITLE, margin, y);
  y += 8;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_THEME.muted);
  doc.text(`Document date: ${data.documentDate}`, right, y - 2, { align: "right" });
  y += 4;

  doc.setFillColor(...PDF_THEME.surface);
  doc.roundedRect(margin, y, contentWidth, 28, 2, 2, "F");

  let rowY = y + 6;
  const leftEnd = fieldRow(doc, "Employee name", data.employeeName, rowY, "left");
  const rightEnd = fieldRow(doc, "Employee ID", data.employeeNo, rowY, "right");
  rowY = Math.max(leftEnd, rightEnd) + 2;

  const l2 = fieldRow(doc, "Designation", data.designation, rowY, "left");
  const r2 = fieldRow(doc, "Department", data.department, rowY, "right");
  rowY = Math.max(l2, r2) + 2;

  const l3 = fieldRow(doc, "Branch", data.branchName ?? "", rowY, "left");
  const r3 = fieldRow(doc, "Aadhaar (last 4 digits)", data.aadhaarLast4 ?? "____", rowY, "right");
  rowY = Math.max(l3, r3) + 4;
  y = rowY + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(...PDF_THEME.text);
  doc.text("Declaration & consent", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  for (const line of splitLines(doc, AADHAAR_CONSENT_STATEMENT, contentWidth)) {
    doc.text(line, margin, y);
    y += 5;
  }
  y += 3;

  doc.setFontSize(9);
  doc.setTextColor(...PDF_THEME.muted);
  doc.text("I understand that my Aadhaar details may be used for the following purposes:", margin, y);
  y += 5;

  doc.setTextColor(...PDF_THEME.text);
  for (const purpose of AADHAAR_CONSENT_PURPOSES) {
    const bullet = splitLines(doc, `• ${purpose}`, contentWidth - 6);
    doc.text(bullet, margin + 2, y);
    y += bullet.length * 4.5 + 1;
  }
  y += 4;

  const clauses = [
    "I confirm that the Aadhaar number provided is my own and is correct to the best of my knowledge.",
    "I authorize Dandakaranya Foods to verify and store my Aadhaar information solely for the purposes stated above.",
    "I have been informed that I may withdraw this consent in writing, subject to statutory and employment requirements.",
  ];
  for (const clause of clauses) {
    for (const line of splitLines(doc, clause, contentWidth)) {
      if (y > 250) {
        doc.addPage();
        y = 20;
      }
      doc.setFontSize(9);
      doc.text(line, margin, y);
      y += 4.5;
    }
    y += 2;
  }

  if (data.isAuthorized && data.authorizedAt) {
    y += 2;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(34, 120, 70);
    doc.text(
      `Digital record on file: authorized ${new Date(data.authorizedAt).toLocaleString("en-IN", {
        dateStyle: "medium",
        timeStyle: "short",
      })}`,
      margin,
      y,
    );
    y += 6;
  }

  y = Math.max(y + 8, 210);
  const sigW = (contentWidth - 8) / 2;
  const sigBoxes = [
    { title: "Employee signature", sub: "Name & date" },
    { title: "HR / Authorized signatory", sub: "Name, designation & date" },
  ];

  for (let i = 0; i < sigBoxes.length; i++) {
    const x = margin + i * (sigW + 8);
    doc.setDrawColor(200, 200, 200);
    doc.rect(x, y, sigW, 28);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_THEME.text);
    doc.text(sigBoxes[i].title, x + 3, y + 6);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(...PDF_THEME.muted);
    doc.text(sigBoxes[i].sub, x + 3, y + 11);
    doc.line(x + 3, y + 22, x + sigW - 3, y + 22);
  }

  doc.setFontSize(7);
  doc.setTextColor(...PDF_THEME.muted);
  doc.text(
    "This is a system-generated consent form. Retain a signed copy in the employee personnel file.",
    margin,
    288,
  );

  return doc;
}
