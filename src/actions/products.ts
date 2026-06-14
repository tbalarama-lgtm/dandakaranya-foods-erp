"use server";

import { revalidatePath } from "next/cache";
import { ActivityAction } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/session";

const productSchema = z.object({
  sku: z.string().min(2),
  name: z.string().min(2),
  barcode: z.string().optional(),
  categoryId: z.string().optional(),
  unit: z.string().default("kg"),
  costPrice: z.coerce.number().nonnegative(),
  salePrice: z.coerce.number().nonnegative(),
  gstPercent: z.coerce.number().min(0).max(100),
  minStockQty: z.coerce.number().nonnegative(),
  stockQty: z.coerce.number().nonnegative().optional(),
  description: z.string().optional(),
  active: z.boolean().optional(),
});

export async function createProduct(data: z.infer<typeof productSchema>) {
  const user = await requirePermission("inventory.edit");
  const parsed = productSchema.parse(data);

  const product = await prisma.product.create({
    data: {
      sku: parsed.sku,
      name: parsed.name,
      barcode: parsed.barcode || null,
      categoryId: parsed.categoryId || null,
      unit: parsed.unit,
      costPrice: parsed.costPrice,
      salePrice: parsed.salePrice,
      gstPercent: parsed.gstPercent,
      minStockQty: parsed.minStockQty,
      stockQty: parsed.stockQty ?? 0,
      description: parsed.description || null,
      active: parsed.active ?? true,
    },
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.CREATE,
    entityType: "Product",
    entityId: product.id,
    message: `Created product ${product.sku} — ${product.name}`,
  });

  revalidatePath("/products");
  revalidatePath("/inventory");
  return product;
}

export async function updateProduct(id: string, data: z.infer<typeof productSchema>) {
  const user = await requirePermission("inventory.edit");
  const parsed = productSchema.parse(data);

  const product = await prisma.product.update({
    where: { id },
    data: {
      sku: parsed.sku,
      name: parsed.name,
      barcode: parsed.barcode || null,
      categoryId: parsed.categoryId || null,
      unit: parsed.unit,
      costPrice: parsed.costPrice,
      salePrice: parsed.salePrice,
      gstPercent: parsed.gstPercent,
      minStockQty: parsed.minStockQty,
      description: parsed.description || null,
      active: parsed.active ?? true,
    },
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.UPDATE,
    entityType: "Product",
    entityId: product.id,
    message: `Updated product ${product.sku}`,
  });

  revalidatePath("/products");
  revalidatePath("/inventory");
  return product;
}
