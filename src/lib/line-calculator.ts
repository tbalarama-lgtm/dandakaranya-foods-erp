import type { Product } from "@prisma/client";

export type LineItemInput = {
  productId: string;
  quantity: number;
  unitPrice?: number;
};

export type CalculatedLine = {
  productId: string;
  quantity: number;
  unitPrice: number;
  gstPercent: number;
  gstAmount: number;
  lineSubtotal: number;
  lineTotal: number;
};

export function calculateLine(
  product: Product,
  quantity: number,
  unitPrice: number | undefined,
  priceField: "salePrice" | "costPrice",
): CalculatedLine {
  const price = unitPrice ?? Number(priceField === "salePrice" ? product.salePrice : product.costPrice || product.salePrice);
  const gstPercent = Number(product.gstPercent);
  const lineSubtotal = price * quantity;
  const gstAmount = (lineSubtotal * gstPercent) / 100;
  return {
    productId: product.id,
    quantity,
    unitPrice: price,
    gstPercent,
    gstAmount,
    lineSubtotal,
    lineTotal: lineSubtotal + gstAmount,
  };
}

export function sumLines(lines: CalculatedLine[]) {
  const subtotal = lines.reduce((s, l) => s + l.lineSubtotal, 0);
  const gstAmount = lines.reduce((s, l) => s + l.gstAmount, 0);
  return { subtotal, gstAmount, total: subtotal + gstAmount };
}
