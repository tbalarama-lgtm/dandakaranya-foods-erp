import type { CompanyProfile } from "@prisma/client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { PayslipData } from "@/lib/hr/payslip-data";
import { dataUrlImageFormat, drawBrandLogo, loadInvoiceLogoDataUrl } from "@/lib/pdf-logo";
import { PDF_PAGE, PDF_THEME } from "@/lib/pdf-theme";
import { formatInrPdf } from "@/lib/utils";

function splitLines(doc: jsPDF, text: string, maxWidth: number): string[] {
  return doc.splitTextToSize(text, maxWidth) as string[];
}

async function drawHeader(doc: jsPDF, company: CompanyProfile | null, data: PayslipData) {
  const { margin, width } = PDF_PAGE;
  const right = width - margin;

  doc.setFillColor(...PDF_THEME.primaryDark);
  doc.rect(0, 0, width, 22, "F");
  doc.setFillColor(...PDF_THEME.accent);
  doc.rect(0, 22, width, 1.2, "F");

  doc.setTextColor(...PDF_THEME.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("SALARY PAYSLIP", margin, 14);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(data.payslipNo, right, 14, { align: "right" });

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
  doc.setFontSize(12);
  doc.text(companyName, textX, y + 2);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(...PDF_THEME.muted);
  let detailY = y + 8;
  const details: string[] = [];
  if (company?.address) details.push(company.address);
  const contact = [company?.phone, company?.email].filter(Boolean).join("  |  ");
  if (contact) details.push(contact);
  if (company?.gstin) details.push(`GSTIN: ${company.gstin}`);

  for (const line of details) {
    for (const wrapped of splitLines(doc, line, 100)) {
      doc.text(wrapped, textX, detailY);
      detailY += 4;
    }
  }

  y = Math.max(detailY + 4, logo ? 62 : 58);
  doc.setFillColor(...PDF_THEME.surface);
  doc.roundedRect(margin, y, PDF_PAGE.contentWidth, 14, 2, 2, "F");
  doc.setTextColor(...PDF_THEME.text);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(`Pay period: ${data.periodLabel}`, margin + 4, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(`Status: ${data.status}`, right - 4, y + 9, { align: "right" });

  return y + 20;
}

function drawEmployeeBox(doc: jsPDF, data: PayslipData, startY: number) {
  const { margin } = PDF_PAGE;
  const colW = PDF_PAGE.contentWidth / 2 - 3;

  const leftFields = [
    ["Employee", data.employee.name],
    ["Employee ID", data.employee.employeeNo],
    ["Department", data.employee.department],
    ["Designation", data.employee.designation],
  ];
  const rightFields = [
    ["Branch", data.employee.branchName ?? "—"],
    ["Email", data.employee.email ?? "—"],
    ["Phone", data.employee.phone ?? "—"],
    ["Date joined", data.employee.joinedAt ?? "—"],
  ];

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...PDF_THEME.text);
  doc.text("Employee details", margin, startY);

  let y = startY + 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);

  for (let i = 0; i < leftFields.length; i++) {
    const rowY = y + i * 5.5;
    doc.setTextColor(...PDF_THEME.muted);
    doc.text(leftFields[i][0], margin, rowY);
    doc.setTextColor(...PDF_THEME.text);
    doc.text(leftFields[i][1], margin + 28, rowY);

    doc.setTextColor(...PDF_THEME.muted);
    doc.text(rightFields[i][0], margin + colW + 8, rowY);
    doc.setTextColor(...PDF_THEME.text);
    const rightVal = splitLines(doc, rightFields[i][1], colW - 20);
    doc.text(rightVal[0], margin + colW + 36, rowY);
  }

  return y + leftFields.length * 5.5 + 8;
}

function drawBreakdown(doc: jsPDF, data: PayslipData, startY: number) {
  const { margin } = PDF_PAGE;
  const half = PDF_PAGE.contentWidth / 2 - 4;

  autoTable(doc, {
    startY,
    margin: { left: margin, right: margin + half + 8 },
    tableWidth: half,
    head: [["Earnings", "Amount (Rs.)"]],
    body: [
      ...data.earnings.map((r) => [r.label, formatInrPdf(r.amount)]),
      [{ content: "Gross pay", styles: { fontStyle: "bold" } }, { content: formatInrPdf(data.grossPay), styles: { fontStyle: "bold" } }],
    ],
    theme: "grid",
    headStyles: { fillColor: PDF_THEME.tableHead, textColor: PDF_THEME.white, fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: PDF_THEME.text },
    alternateRowStyles: { fillColor: PDF_THEME.tableAlt },
  });

  const earningsEnd =
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 40;

  autoTable(doc, {
    startY,
    margin: { left: margin + half + 8, right: margin },
    tableWidth: half,
    head: [["Deductions", "Amount (Rs.)"]],
    body: [
      ...data.deductions.map((r) => [r.label, formatInrPdf(r.amount)]),
      [
        { content: "Total deductions", styles: { fontStyle: "bold" } },
        { content: formatInrPdf(data.totalDeductions), styles: { fontStyle: "bold" } },
      ],
    ],
    theme: "grid",
    headStyles: { fillColor: PDF_THEME.tableHead, textColor: PDF_THEME.white, fontSize: 8 },
    bodyStyles: { fontSize: 8, textColor: PDF_THEME.text },
    alternateRowStyles: { fillColor: PDF_THEME.tableAlt },
  });

  return Math.max(
    earningsEnd,
    (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? startY + 40,
  );
}

function drawNetPay(doc: jsPDF, data: PayslipData, startY: number) {
  const { margin, width } = PDF_PAGE;
  const boxW = PDF_PAGE.contentWidth;

  doc.setFillColor(...PDF_THEME.primary);
  doc.roundedRect(margin, startY, boxW, 16, 2, 2, "F");
  doc.setTextColor(...PDF_THEME.white);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Net pay (take home)", margin + 6, startY + 10);
  doc.setFontSize(13);
  doc.text(formatInrPdf(data.netPay), width - margin - 6, startY + 10, { align: "right" });

  const footerY = startY + 24;
  doc.setTextColor(...PDF_THEME.muted);
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7);
  doc.text(
    "This is a computer-generated payslip and does not require a physical signature.",
    margin,
    footerY,
  );
  doc.text(`Generated on ${new Date().toLocaleDateString("en-IN")}`, margin, footerY + 4);
}

export async function buildPayslipPdf(data: PayslipData, company: CompanyProfile | null): Promise<jsPDF> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = await drawHeader(doc, company, data);
  y = drawEmployeeBox(doc, data, y);
  y = drawBreakdown(doc, data, y) + 6;
  drawNetPay(doc, data, y);
  return doc;
}
