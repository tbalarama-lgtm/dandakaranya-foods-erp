"use server";

import { revalidatePath } from "next/cache";
import { ActivityAction, PaymentStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { ensurePurchaseApprovals } from "@/lib/procurement-metrics";
import { requirePermission } from "@/lib/session";
import { calculateLine, sumLines, type LineItemInput } from "@/lib/line-calculator";

export async function updatePurchaseStatus(id: string, status: PaymentStatus) {
  const user = await requirePermission("purchases.edit");
  await prisma.purchase.update({ where: { id }, data: { paymentStatus: status } });
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.UPDATE,
    entityType: "Purchase",
    entityId: id,
    message: `Updated purchase payment status to ${status}`,
  });
  revalidatePath("/purchases");
  revalidatePath("/");
}

const lineSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().nonnegative().optional(),
});

const createPurchaseSchema = z.object({
  vendorId: z.string(),
  lines: z.array(lineSchema).min(1),
  notes: z.string().optional(),
});

export async function createPurchase(data: z.infer<typeof createPurchaseSchema>) {
  const user = await requirePermission("purchases.create");
  const parsed = createPurchaseSchema.parse(data);

  const vendor = await prisma.vendor.findUniqueOrThrow({ where: { id: parsed.vendorId } });
  const productIds = [...new Set(parsed.lines.map((l) => l.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const calculated = parsed.lines.map((line) => {
    const product = productMap[line.productId];
    if (!product) throw new Error(`Product not found: ${line.productId}`);
    return calculateLine(product, line.quantity, line.unitPrice, "costPrice");
  });

  const { subtotal, gstAmount, total } = sumLines(calculated);
  const count = await prisma.purchase.count();
  const purchaseNumber = `PO-2026-${String(count + 1).padStart(4, "0")}`;

  const purchase = await prisma.$transaction(async (tx) => {
    const po = await tx.purchase.create({
      data: {
        purchaseNumber,
        vendorId: vendor.id,
        userId: user.id,
        subtotal,
        gstAmount,
        total,
        notes: parsed.notes || null,
        poStatus: "DRAFT",
        procurementStage: "DRAFT",
        approvalStatus: "PENDING",
        items: {
          create: calculated.map((line) => ({
            productId: line.productId,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            gstPercent: line.gstPercent,
            gstAmount: line.gstAmount,
            lineTotal: line.lineTotal,
          })),
        },
      },
    });

    return po;
  });

  await ensurePurchaseApprovals(purchase.id);

  try {
    const { resolveBudgetForPurchase } = await import("@/lib/budget-metrics");
    const { commitPurchaseToBudget } = await import("@/actions/budget-workflow");
    const resolved = await resolveBudgetForPurchase({
      classification: vendor.classification,
      poAmount: Number(total),
    });
    if (resolved.budgetId) {
      await commitPurchaseToBudget(purchase.id, resolved.budgetId);
    }
  } catch {
    /* budget schema optional until db:push */
  }

  try {
    await prisma.pOEvent.create({
      data: { purchaseId: purchase.id, eventType: "CREATED", title: `PO ${purchaseNumber} drafted`, userId: user.id },
    });
  } catch {
    /* optional */
  }

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.CREATE,
    entityType: "Purchase",
    entityId: purchase.id,
    message: `Created draft PO ${purchaseNumber} (${parsed.lines.length} items) from ${vendor.name}`,
  });

  revalidatePath("/purchases");
  revalidatePath("/");
  return purchase;
}

/** @deprecated Use createPurchase with lines */
export async function createSimplePurchase(data: LineItemInput & { vendorId: string }) {
  return createPurchase({
    vendorId: data.vendorId,
    lines: [{ productId: data.productId, quantity: data.quantity, unitPrice: data.unitPrice }],
  });
}
