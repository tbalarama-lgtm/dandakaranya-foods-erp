import type { CompanyProfile, Customer, Product, SaleInvoice, SaleInvoiceItem } from "@prisma/client";
import { toNumber } from "@/lib/utils";

export type InvoiceForPdf = Omit<
  SaleInvoice,
  "subtotal" | "gstAmount" | "total" | "cgstAmount" | "sgstAmount" | "igstAmount" | "discountAmount" | "shippingAmount" | "paidAmount"
> & {
  subtotal: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  discountAmount: number;
  shippingAmount: number;
  paidAmount: number;
  total: number;
  customer: Customer;
  items: (Omit<SaleInvoiceItem, "quantity" | "unitPrice" | "gstPercent" | "gstAmount" | "lineTotal"> & {
    quantity: number;
    unitPrice: number;
    gstPercent: number;
    gstAmount: number;
    lineTotal: number;
    product: Product;
  })[];
};

export function serializeInvoiceForPdf(
  invoice: SaleInvoice & {
    customer: Customer;
    items: (SaleInvoiceItem & { product: Product })[];
  },
): InvoiceForPdf {
  return {
    ...invoice,
    subtotal: toNumber(invoice.subtotal),
    discountAmount: toNumber(invoice.discountAmount),
    shippingAmount: toNumber(invoice.shippingAmount),
    cgstAmount: toNumber(invoice.cgstAmount),
    sgstAmount: toNumber(invoice.sgstAmount),
    igstAmount: toNumber(invoice.igstAmount),
    gstAmount: toNumber(invoice.gstAmount),
    paidAmount: toNumber(invoice.paidAmount),
    total: toNumber(invoice.total),
    items: invoice.items.map((item) => ({
      ...item,
      quantity: toNumber(item.quantity),
      unitPrice: toNumber(item.unitPrice),
      gstPercent: toNumber(item.gstPercent),
      gstAmount: toNumber(item.gstAmount),
      lineTotal: toNumber(item.lineTotal),
      product: item.product,
    })),
  };
}

export type CompanyForPdf = CompanyProfile | null;
