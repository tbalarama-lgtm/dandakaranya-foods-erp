import type { Product } from "@prisma/client";
import { toNumber } from "@/lib/utils";

/** Product shape safe to pass from Server Components to Client Components. */
export type ClientProduct = Omit<
  Product,
  "costPrice" | "salePrice" | "gstPercent" | "stockQty" | "minStockQty"
> & {
  costPrice: number;
  salePrice: number;
  gstPercent: number;
  stockQty: number;
  minStockQty: number;
};

export function serializeProduct(product: Product): ClientProduct {
  return {
    ...product,
    costPrice: toNumber(product.costPrice),
    salePrice: toNumber(product.salePrice),
    gstPercent: toNumber(product.gstPercent),
    stockQty: toNumber(product.stockQty),
    minStockQty: toNumber(product.minStockQty),
  };
}

export function serializeProducts(products: Product[]): ClientProduct[] {
  return products.map(serializeProduct);
}
