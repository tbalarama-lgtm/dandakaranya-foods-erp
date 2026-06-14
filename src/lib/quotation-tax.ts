import type { Product } from "@prisma/client";
import type { QuotationLineItem } from "@/lib/quotation-types";
import type { QuotationTaxMode } from "@prisma/client";

export type QuoteLineInput = {
  productId: string;
  quantity: number;
  unitPrice?: number;
  discountPercent?: number;
};

export function calculateQuoteLine(
  product: Product,
  input: QuoteLineInput,
  taxMode: QuotationTaxMode,
): QuotationLineItem {
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
  };
}

export function sumQuoteLines(
  lines: QuotationLineItem[],
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

export function requiresPricingApproval(lines: QuotationLineItem[], products: Product[]): boolean {
  for (const line of lines) {
    const product = products.find((p) => p.id === line.productId);
    if (!product) continue;
    const listPrice = Number(product.salePrice);
    if (line.unitPrice < listPrice * 0.85) return true;
    if ((line.discountPercent ?? 0) > 10) return true;
  }
  return false;
}
