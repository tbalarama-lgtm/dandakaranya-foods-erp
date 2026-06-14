import type { CompanyProfile, Customer, Quotation } from "@prisma/client";
import jsPDF from "jspdf";
import autoTable, { applyPlugin } from "jspdf-autotable";
import { dataUrlImageFormat, drawBrandLogo, loadInvoiceLogoDataUrl } from "@/lib/pdf-logo";
import { PDF_PAGE, PDF_THEME } from "@/lib/pdf-theme";
import type { QuotationLineItem } from "@/lib/quotation-types";
import { QUOTE_TAX_MODE_LABELS } from "@/lib/quotation-types";
import { formatInrPdf, toNumber } from "@/lib/utils";

applyPlugin(jsPDF);

type QuoteForPdf = Quotation & {
  customer: Customer | null;
  user: { name: string } | null;
};

export async function buildQuotationPdf(
  quote: QuoteForPdf,
  company: CompanyProfile | null,
): Promise<jsPDF> {
  const doc = new jsPDF();
  const { margin, width } = PDF_PAGE;
  const right = width - margin;

  doc.setFillColor(...PDF_THEME.primaryDark);
  doc.rect(0, 0, width, 22, "F");
  doc.setFillColor(...PDF_THEME.accent);
  doc.rect(0, 22, width, 1.2, "F");

  doc.setTextColor(...PDF_THEME.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("COMMERCIAL QUOTATION", margin, 14);

  let y = 32;
  const logo = await loadInvoiceLogoDataUrl(company?.logoUrl);
  if (logo) {
    try {
      drawBrandLogo(doc, logo, dataUrlImageFormat(logo), margin, y - 2, 24);
    } catch {
      /* skip */
    }
  }

  doc.setTextColor(...PDF_THEME.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text(company?.legalName || company?.name || "Dandakaranya Foods", margin + 30, y + 2);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_THEME.muted);
  if (company?.gstin) doc.text(`GSTIN: ${company.gstin}`, margin + 30, y + 8);

  y += 22;
  doc.setTextColor(...PDF_THEME.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Quote: ${quote.quoteNumber}`, margin, y);
  if (quote.revisionNumber > 1) doc.text(`Rev. ${quote.revisionNumber}`, margin + 60, y);
  doc.text(`Date: ${new Date(quote.createdAt).toLocaleDateString("en-IN")}`, right, y, { align: "right" });
  y += 6;
  if (quote.validUntil) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.text(`Valid until: ${new Date(quote.validUntil).toLocaleDateString("en-IN")}`, margin, y);
  }

  y += 10;
  const customerName = quote.customer?.name ?? "Customer";
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Bill To:", margin, y);
  doc.setFont("helvetica", "normal");
  doc.text(customerName, margin, y + 5);
  if (quote.customer?.company) doc.text(quote.customer.company, margin, y + 10);
  if (quote.customer?.gstin) doc.text(`GSTIN: ${quote.customer.gstin}`, margin, y + 15);

  doc.setFont("helvetica", "bold");
  doc.text("Prepared by:", right - 50, y);
  doc.setFont("helvetica", "normal");
  doc.text(quote.user?.name ?? "Sales Team", right - 50, y + 5);

  y += 28;
  const items = quote.items as QuotationLineItem[];
  autoTable(doc, {
    startY: y,
    head: [["#", "Product", "HSN", "Qty", "Rate", "Disc%", "CGST", "SGST", "IGST", "Amount"]],
    body: items.map((line, i) => [
      String(i + 1),
      line.productName,
      line.hsnCode ?? "—",
      String(line.quantity),
      formatInrPdf(line.unitPrice),
      line.discountPercent ? `${line.discountPercent}%` : "—",
      formatInrPdf(line.cgstAmount),
      formatInrPdf(line.sgstAmount),
      formatInrPdf(line.igstAmount),
      formatInrPdf(line.lineTotal),
    ]),
    styles: { fontSize: 7, cellPadding: 2 },
    headStyles: { fillColor: PDF_THEME.primaryDark, textColor: PDF_THEME.white },
    theme: "grid",
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 40;
  y += 8;

  const totals: [string, string][] = [
    ["Subtotal", formatInrPdf(toNumber(quote.subtotal))],
    ["Shipping", formatInrPdf(toNumber(quote.shippingAmount))],
    ["Discount", formatInrPdf(toNumber(quote.discountAmount))],
    [`Tax (${QUOTE_TAX_MODE_LABELS[quote.taxMode]})`, formatInrPdf(toNumber(quote.gstAmount))],
    ["Total", formatInrPdf(toNumber(quote.total))],
  ];
  if (quote.currency !== "INR") {
    totals.push([`Currency`, quote.currency]);
    if (quote.exchangeRate) totals.push(["Exchange rate", String(quote.exchangeRate)]);
  }

  autoTable(doc, {
    startY: y,
    body: totals,
    theme: "plain",
    styles: { fontSize: 9 },
    columnStyles: { 0: { fontStyle: "bold" }, 1: { halign: "right" } },
    margin: { left: width - margin - 70 },
  });

  y = (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y + 30;
  y += 10;

  const exportFields: string[] = [];
  if (quote.incoterms) exportFields.push(`Incoterms: ${quote.incoterms}`);
  if (quote.pricingTerms) exportFields.push(`Pricing: ${quote.pricingTerms}`);
  if (quote.moq) exportFields.push(`MOQ: ${quote.moq}`);
  if (quote.packagingConfig) exportFields.push(`Packaging: ${quote.packagingConfig}`);
  if (quote.containerQty) exportFields.push(`Containers: ${quote.containerQty}`);
  if (quote.shelfLife) exportFields.push(`Shelf life: ${quote.shelfLife}`);

  if (exportFields.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("Export / Commercial Terms", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    exportFields.forEach((f, i) => doc.text(f, margin, y + 6 + i * 5));
    y += 6 + exportFields.length * 5 + 4;
  }

  if (quote.notes) {
    doc.setFont("helvetica", "bold");
    doc.text("Notes", margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(quote.notes, margin, y + 5, { maxWidth: width - margin * 2 });
    y += 15;
  }

  if (quote.signatureStatus === "SIGNED" && quote.signatureName) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.text(`Digitally accepted by: ${quote.signatureName}`, margin, y);
    if (quote.signedAt) {
      doc.text(`Signed: ${new Date(quote.signedAt).toLocaleDateString("en-IN")}`, margin, y + 5);
    }
  } else {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_THEME.muted);
    doc.text("Authorized signature: _________________________", margin, y + 10);
  }

  doc.setFontSize(7);
  doc.text(
    "This quotation is subject to our standard terms and conditions. Prices valid until date shown above.",
    margin,
    285,
  );

  return doc;
}
