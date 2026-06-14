import type { CompanyProfile, Customer } from "@prisma/client";
import jsPDF from "jspdf";
import autoTable, { applyPlugin } from "jspdf-autotable";
import { dataUrlImageFormat, drawBrandLogo, loadInvoiceLogoDataUrl } from "@/lib/pdf-logo";
import { PDF_PAGE, PDF_THEME } from "@/lib/pdf-theme";
import type { InvoiceForPdf } from "@/lib/serialize-invoice";
import { formatInrPdf, toNumber } from "@/lib/utils";

applyPlugin(jsPDF);

type InvoiceWithRelations = InvoiceForPdf;

type JsPDFWithAutoTable = jsPDF & { lastAutoTable?: { finalY: number } };

function formatInvoiceDate(d: Date | string) {
  return new Date(d).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function splitLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

async function drawCorporateHeader(
  doc: jsPDF,
  company: CompanyProfile | null,
  invoice: InvoiceWithRelations,
) {
  const { margin, width } = PDF_PAGE;
  const right = width - margin;

  doc.setFillColor(...PDF_THEME.primaryDark);
  doc.rect(0, 0, width, 22, "F");
  doc.setFillColor(...PDF_THEME.accent);
  doc.rect(0, 22, width, 1.2, "F");

  doc.setTextColor(...PDF_THEME.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("TAX INVOICE", margin, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Original for Recipient", right, 14, { align: "right" });

  let y = 32;
  const logo = await loadInvoiceLogoDataUrl(company?.logoUrl);
  const logoSize = 28;
  const textX = logo ? margin + logoSize + 8 : margin;

  if (logo) {
    try {
      drawBrandLogo(doc, logo, dataUrlImageFormat(logo), margin, y - 2, logoSize);
    } catch {
      /* continue without logo */
    }
  }

  const companyName = company?.legalName || company?.name || "Dandakaranya Foods";
  doc.setTextColor(...PDF_THEME.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text(companyName, textX, y + 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_THEME.muted);
  let detailY = y + 8;
  const details: string[] = [];
  if (company?.tagline) details.push(company.tagline);
  if (company?.address) details.push(company.address);
  const contact = [company?.phone, company?.email].filter(Boolean).join("  |  ");
  if (contact) details.push(contact);
  if (company?.gstin) details.push(`GSTIN: ${company.gstin}`);
  if (company?.website) details.push(company.website);

  for (const line of details) {
    const wrapped = splitLines(doc, line, 95);
    for (const w of wrapped) {
      doc.text(w, textX, detailY);
      detailY += 4;
    }
  }

  const boxW = 72;
  const boxX = right - boxW;
  const boxY = y - 2;
  doc.setDrawColor(...PDF_THEME.border);
  doc.setFillColor(...PDF_THEME.surface);
  doc.setLineWidth(0.3);
  doc.roundedRect(boxX, boxY, boxW, 38, 2, 2, "FD");

  doc.setTextColor(...PDF_THEME.text);
  doc.setFontSize(8);
  const meta: [string, string][] = [
    ["Invoice No.", invoice.invoiceNumber],
    ["Invoice Date", formatInvoiceDate(invoice.invoiceDate)],
  ];
  if (invoice.dueDate) meta.push(["Due Date", formatInvoiceDate(invoice.dueDate)]);
  const statusLabel =
    "status" in invoice && typeof invoice.status === "string"
      ? invoice.status.replace(/_/g, " ")
      : invoice.paymentStatus.replace("_", " ");
  meta.push(["Status", statusLabel]);
  meta.push(["Delivery", invoice.deliveryStatus.replace("_", " ")]);

  let metaY = boxY + 7;
  for (const [label, value] of meta) {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_THEME.muted);
    doc.text(label, boxX + 4, metaY);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...PDF_THEME.text);
    doc.text(value, boxX + boxW - 4, metaY, { align: "right" });
    metaY += 6;
  }

  y = Math.max(detailY, boxY + 42) + 6;
  doc.setDrawColor(...PDF_THEME.border);
  doc.setLineWidth(0.4);
  doc.line(margin, y, right, y);

  return y + 8;
}

function drawPartyBoxes(doc: jsPDF, customer: Customer, startY: number) {
  const { margin, width } = PDF_PAGE;
  const right = width - margin;
  const colW = (right - margin - 8) / 2;
  const boxH = 36;

  const drawBox = (x: number, title: string, lines: string[]) => {
    doc.setDrawColor(...PDF_THEME.border);
    doc.setFillColor(...PDF_THEME.white);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, startY, colW, boxH, 1.5, 1.5, "FD");

    doc.setFillColor(...PDF_THEME.primary);
    doc.rect(x, startY, colW, 7, "F");
    doc.setTextColor(...PDF_THEME.white);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.text(title, x + 4, startY + 5);

    doc.setTextColor(...PDF_THEME.text);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    let ly = startY + 12;
    for (const line of lines.filter(Boolean)) {
      const wrapped = splitLines(doc, line, colW - 8);
      for (const w of wrapped.slice(0, 3)) {
        doc.text(w, x + 4, ly);
        ly += 4.2;
      }
    }
  };

  const billLines = [
    customer.name,
    customer.company ?? "",
    customer.address ?? "",
    [customer.city, customer.state, customer.pincode].filter(Boolean).join(", "),
    customer.phone ? `Ph: ${customer.phone}` : "",
    customer.gstin ? `GSTIN: ${customer.gstin}` : "",
  ];

  drawBox(margin, "BILL TO", billLines);
  drawBox(margin + colW + 8, "PLACE OF SUPPLY", [
    customer.state ? `State: ${customer.state}` : "Chhattisgarh",
    "Country: India",
    "",
    "Reverse Charge: No",
  ]);

  return startY + boxH + 10;
}

function drawLineItemsFallback(doc: jsPDF, invoice: InvoiceWithRelations, startY: number): number {
  const { margin } = PDF_PAGE;
  let y = startY + 4;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_THEME.text);
  doc.text("Line items", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  const rows =
    invoice.items.length === 0
      ? [{ desc: "No line items on this invoice", qty: "—", rate: "—", gst: "—", amt: "—" }]
      : invoice.items.map((item, idx) => {
          const qty = toNumber(item.quantity);
          const rate = toNumber(item.unitPrice);
          const gstPct = toNumber(item.gstPercent);
          const gstAmt = toNumber(item.gstAmount);
          const desc = item.product.sku
            ? `${idx + 1}. ${item.product.name} (${item.product.sku})`
            : `${idx + 1}. ${item.product.name}`;
          return {
            desc,
            qty: `${qty.toFixed(2)} ${item.product.unit || "kg"}`,
            rate: formatInrPdf(rate),
            gst: `${gstPct}% / ${formatInrPdf(gstAmt)}`,
            amt: formatInrPdf(item.lineTotal),
          };
        });

  for (const row of rows) {
    doc.text(row.desc, margin, y);
    y += 4;
    doc.setTextColor(...PDF_THEME.muted);
    doc.text(`Qty: ${row.qty}   Rate: ${row.rate}   GST: ${row.gst}   Amount: ${row.amt}`, margin + 2, y);
    doc.setTextColor(...PDF_THEME.text);
    y += 6;
  }

  return y + 4;
}

function drawLineItemsTable(doc: jsPDF, invoice: InvoiceWithRelations, startY: number): number {
  const { margin } = PDF_PAGE;
  const body =
    invoice.items.length === 0
      ? [["—", "No line items on this invoice", "—", "—", "—", "—"]]
      : invoice.items.map((item, idx) => {
          const qty = toNumber(item.quantity);
          const rate = toNumber(item.unitPrice);
          const gstAmt = toNumber(item.gstAmount);
          const gstPct = toNumber(item.gstPercent);
          const desc = item.product.sku
            ? `${item.product.name} (${item.product.sku})`
            : item.product.name;
          return [
            String(idx + 1),
            desc,
            qty.toFixed(2),
            formatInrPdf(rate),
            `${gstPct}% / ${formatInrPdf(gstAmt)}`,
            formatInrPdf(item.lineTotal),
          ];
        });

  try {
    autoTable(doc, {
      startY,
      margin: { left: margin, right: margin },
      head: [["#", "Description / SKU", "Qty", "Rate", "GST", "Amount"]],
      body,
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [33, 37, 41],
        lineColor: [218, 222, 226],
        lineWidth: 0.2,
        overflow: "linebreak",
        valign: "middle",
      },
      headStyles: {
        fillColor: [45, 74, 62],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        halign: "center",
      },
      alternateRowStyles: { fillColor: [245, 247, 246] },
      columnStyles: {
        0: { cellWidth: 10, halign: "center" },
        1: { cellWidth: 72 },
        2: { cellWidth: 18, halign: "right" },
        3: { cellWidth: 28, halign: "right" },
        4: { cellWidth: 32, halign: "right" },
        5: { cellWidth: 22, halign: "right", fontStyle: "bold" },
      },
    });

    const finalY = (doc as JsPDFWithAutoTable).lastAutoTable?.finalY;
    if (finalY && finalY > startY + 4) return finalY;
  } catch (err) {
    console.error("[invoice-pdf] autoTable failed, using fallback:", err);
  }

  return drawLineItemsFallback(doc, invoice, startY);
}

function drawTotalsAndFooter(
  doc: jsPDF,
  invoice: InvoiceWithRelations,
  company: CompanyProfile | null,
  tableEndY: number,
) {
  const { margin, width, height } = PDF_PAGE;
  const right = width - margin;
  let y = tableEndY + 8;

  const subtotal = toNumber(invoice.subtotal);
  const gst = toNumber(invoice.gstAmount);
  const total = toNumber(invoice.total);
  const roundOff = Math.round(total) - total;

  const boxW = 78;
  const boxX = right - boxW;
  const rows: [string, string, boolean?][] = [
    ["Taxable Amount", formatInrPdf(subtotal)],
    ["Total GST", formatInrPdf(gst)],
    ...(Math.abs(roundOff) >= 0.01 ? [["Round Off", formatInrPdf(roundOff)] as [string, string]] : []),
    ["Grand Total", formatInrPdf(Math.round(total)), true],
  ];

  const boxH = 8 + rows.length * 7 + 4;
  doc.setDrawColor(...PDF_THEME.border);
  doc.setFillColor(...PDF_THEME.surface);
  doc.roundedRect(boxX, y, boxW, boxH, 2, 2, "FD");

  let rowY = y + 8;
  for (const [label, value, bold] of rows) {
    if (bold) {
      doc.setFillColor(...PDF_THEME.primary);
      doc.rect(boxX, rowY - 5, boxW, 9, "F");
      doc.setTextColor(...PDF_THEME.white);
      doc.setFont("helvetica", "bold");
    } else {
      doc.setTextColor(...PDF_THEME.text);
      doc.setFont("helvetica", "normal");
    }
    doc.setFontSize(bold ? 10 : 9);
    doc.text(label, boxX + 4, rowY);
    doc.text(value, boxX + boxW - 4, rowY, { align: "right" });
    rowY += bold ? 10 : 7;
  }

  y += boxH + 6;
  doc.setTextColor(...PDF_THEME.muted);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(8);
  doc.text("Amount in words: ", margin, y);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...PDF_THEME.text);
  doc.text(amountInWords(Math.round(total)), margin + 28, y);

  if (invoice.notes?.trim()) {
    y += 10;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...PDF_THEME.text);
    doc.text("Notes / Terms", margin, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...PDF_THEME.muted);
    const noteLines = splitLines(doc, invoice.notes, PDF_PAGE.contentWidth);
    y += 5;
    for (const line of noteLines) {
      doc.text(line, margin, y);
      y += 4;
    }
  }

  const footerY = height - 28;
  doc.setDrawColor(...PDF_THEME.border);
  doc.setLineWidth(0.3);
  doc.line(margin, footerY, right, footerY);

  doc.setFontSize(7);
  doc.setTextColor(...PDF_THEME.muted);
  doc.setFont("helvetica", "normal");
  const companyName = company?.legalName || company?.name || "Dandakaranya Foods";
  doc.text(
    "This is a computer-generated invoice and is valid without signature unless otherwise required.",
    margin,
    footerY + 5,
  );
  doc.text(
    `Thank you for your business. | ${companyName} | ${company?.website ?? "dandakaranyafoods.com"}`,
    margin,
    footerY + 10,
  );

  const sigY = footerY + 18;
  doc.setDrawColor(...PDF_THEME.border);
  doc.line(right - 55, sigY, right, sigY);
  doc.setFontSize(7);
  doc.text("Authorised Signatory", right - 27.5, sigY + 4, { align: "center" });

  doc.setFontSize(7);
  doc.text(`Page 1 of 1`, right, height - 8, { align: "right" });
}

/** Indian numbering amount in words (simplified, up to crores). */
function amountInWords(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "—";
  if (n === 0) return "Zero Rupees Only";
  const ones = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function two(n: number): string {
    if (n < 20) return ones[n];
    return `${tens[Math.floor(n / 10)]}${ones[n % 10] ? ` ${ones[n % 10]}` : ""}`.trim();
  }

  function three(n: number): string {
    if (n < 100) return two(n);
    return `${ones[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${two(n % 100)}` : ""}`;
  }

  const parts: string[] = [];
  let rem = Math.floor(n);

  const crore = Math.floor(rem / 10000000);
  if (crore) {
    parts.push(`${three(crore)} Crore`);
    rem %= 10000000;
  }
  const lakh = Math.floor(rem / 100000);
  if (lakh) {
    parts.push(`${three(lakh)} Lakh`);
    rem %= 100000;
  }
  const thousand = Math.floor(rem / 1000);
  if (thousand) {
    parts.push(`${three(thousand)} Thousand`);
    rem %= 1000;
  }
  if (rem) parts.push(three(rem));

  return `${parts.join(" ").trim()} Rupees Only`;
}

export async function buildInvoicePdf(
  invoice: InvoiceWithRelations,
  company: CompanyProfile | null,
): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  let y = await drawCorporateHeader(doc, company, invoice);
  y = drawPartyBoxes(doc, invoice.customer, y);
  const tableEndY = drawLineItemsTable(doc, invoice, y);
  drawTotalsAndFooter(doc, invoice, company, tableEndY);

  return doc;
}
