import type { SaleInvoiceItem } from "@prisma/client";
import type { Product } from "@prisma/client";
import type { InvoiceLineItem } from "@/lib/invoice-types";
import { toNumber } from "@/lib/utils";

export function serializeInvoiceItems(
  items: (SaleInvoiceItem & { product: Product })[],
): InvoiceLineItem[] {
  return items.map((item) => ({
    productId: item.productId,
    productName: item.product.name,
    sku: item.sku ?? item.product.sku,
    hsnCode: item.hsnCode ?? item.product.hsnCode ?? undefined,
    quantity: toNumber(item.quantity),
    unitPrice: toNumber(item.unitPrice),
    discountPercent: toNumber(item.discountPercent),
    discountAmount: toNumber(item.discountAmount),
    gstPercent: toNumber(item.gstPercent),
    cgstAmount: toNumber(item.cgstAmount),
    sgstAmount: toNumber(item.sgstAmount),
    igstAmount: toNumber(item.igstAmount),
    lineSubtotal:
      toNumber(item.unitPrice) * toNumber(item.quantity) - toNumber(item.discountAmount),
    lineTotal: toNumber(item.lineTotal),
    batchNumber: item.batchNumber ?? undefined,
    expiryDate: item.expiryDate ?? undefined,
    packagingNotes: item.packagingNotes ?? undefined,
    warehouseId: item.warehouseId ?? undefined,
  }));
}
