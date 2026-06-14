"use server";

import { revalidatePath } from "next/cache";
import { ActivityAction } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/session";

export async function toggleProductActive(productId: string, active: boolean) {
  const user = await requirePermission("inventory.edit");
  await prisma.product.update({ where: { id: productId }, data: { active } });
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.UPDATE,
    entityType: "Product",
    entityId: productId,
    message: `Product ${active ? "activated" : "deactivated"}`,
  });
  revalidatePath("/inventory");
  revalidatePath("/products");
}
