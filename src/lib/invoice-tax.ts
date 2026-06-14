import type { Product } from "@prisma/client";
import type { QuotationTaxMode } from "@prisma/client";
import type { InvoiceLineItem } from "@/lib/invoice-types";

export type InvoiceLineInput = {
  productId: string;
  quantity: number;
  unitPrice?: number;
  discountPercent?: number;
  batchNumber?: string;
  expiryDate?: string;
  packagingNotes?: string;
  warehouseId?: string;
};

export function calculateInvoiceLine(
  product: Product,
  input: InvoiceLineInput,
  taxMode: QuotationTaxMode,
): InvoiceLineItem {
  const unitPrice = input.unitPrice ?? Number(product.salePrice);
  const qty = input.quantity;
  const discountPercent = input.discountPercent ?? 0;
  const gross = unitPrice * qty;
  const discountAmount = (gross * discountPercent) / 100;
  const lineSubtotal = gross - discountAmount;
  const gstPercent = taxMode === "EXPORT" ? 0 : Number(product.gstPercent);

  let cgstAmount = 0;
  let sgstAmount = 0;
  let igstAmount = 0;

  if (taxMode === "DOMESTIC") {
    const half = (lineSubtotal * gstPercent) / 100 / 2;
    cgstAmount = half;
    sgstAmount = half;
  } else if (taxMode === "IGST") {
    igstAmount = (lineSubtotal * gstPercent) / 100;
  }

  const gstTotal = cgstAmount + sgstAmount + igstAmount;

  return {
    productId: product.id,
    productName: product.name,
    sku: product.sku,
    hsnCode: product.hsnCode ?? undefined,
    quantity: qty,
    unitPrice,
    discountPercent,
    discountAmount,
    gstPercent,
    cgstAmount,
    sgstAmount,
    igstAmount,
    lineSubtotal,
    lineTotal: lineSubtotal + gstTotal,
    batchNumber: input.batchNumber,
    expiryDate: input.expiryDate,
    packagingNotes: input.packagingNotes,
    warehouseId: input.warehouseId ?? product.warehouseId ?? undefined,
  };
}

export function sumInvoiceLines(
  lines: InvoiceLineItem[],
  shippingAmount = 0,
  quoteDiscount = 0,
) {
  const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
  const cgstAmount = lines.reduce((s, l) => s + l.cgstAmount, 0);
  const sgstAmount = lines.reduce((s, l) => s + l.sgstAmount, 0);
  const igstAmount = lines.reduce((s, l) => s + l.igstAmount, 0);
  const gstAmount = cgstAmount + sgstAmount + igstAmount;
  const total = subtotal + gstAmount + shippingAmount - quoteDiscount;

  return {
    subtotal,
    discountAmount: quoteDiscount,
    shippingAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    gstAmount,
    total: Math.max(0, total),
  };
}

export function estimateMargin(lines: InvoiceLineItem[], products: Product[]): number {
  let revenue = 0;
  let cost = 0;
  for (const line of lines) {
    const p = products.find((x) => x.id === line.productId);
    if (!p) continue;
    revenue += line.lineSubtotal;
    cost += Number(p.costPrice) * line.quantity;
  }
  return revenue > 0 ? Math.round(((revenue - cost) / revenue) * 1000) / 10 : 0;
}
