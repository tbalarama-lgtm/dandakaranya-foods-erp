import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { SaleInvoice, Customer, SaleInvoiceItem, Product } from "@prisma/client";

type InvoiceWithRelations = SaleInvoice & {
  customer: Customer;
  items: (SaleInvoiceItem & { product: Product })[];
};

export function exportInvoicePdf(invoice: InvoiceWithRelations) {
  const doc = new jsPDF();
  doc.setFontSize(18);
  doc.text("Dandakaranya Foods", 14, 20);
  doc.setFontSize(11);
  doc.text(`Invoice: ${invoice.invoiceNumber}`, 14, 28);
  doc.text(`Date: ${new Date(invoice.invoiceDate).toLocaleDateString("en-IN")}`, 14, 34);
  doc.text(`Customer: ${invoice.customer.name}`, 14, 42);
  if (invoice.customer.gstin) doc.text(`GSTIN: ${invoice.customer.gstin}`, 14, 48);

  autoTable(doc, {
    startY: 56,
    head: [["Product", "Qty", "Rate", "GST%", "Total"]],
    body: invoice.items.map((i) => [
      i.product.name,
      String(i.quantity),
      String(i.unitPrice),
      `${i.gstPercent}%`,
      String(i.lineTotal),
    ]),
  });

  const finalY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.text(`Subtotal: ₹${invoice.subtotal}`, 14, finalY);
  doc.text(`GST: ₹${invoice.gstAmount}`, 14, finalY + 6);
  doc.setFontSize(13);
  doc.text(`Total: ₹${invoice.total}`, 14, finalY + 14);

  doc.save(`${invoice.invoiceNumber}.pdf`);
}
