"use server";

import { revalidatePath } from "next/cache";
import {
  ActivityAction,
  RFQEventType,
  RFQStatus,
  TamarindGrade,
} from "@prisma/client";
import { z } from "zod";
import { actionFail, actionOk, type ActionResult } from "@/lib/action-result";
import { logActivity } from "@/lib/activity";
import { prisma } from "@/lib/db";
import { compareRfqQuotes } from "@/lib/rfq-metrics";
import { hasPrismaDelegate } from "@/lib/prisma-safe";
import { ensurePurchaseApprovals } from "@/lib/procurement-metrics";
import { requirePermission } from "@/lib/session";
import { toNumber } from "@/lib/utils";
import { calculateLine, sumLines } from "@/lib/line-calculator";

async function logRfqEvent(
  rfqId: string,
  eventType: RFQEventType,
  title: string,
  opts?: { detail?: string; userId?: string; vendorId?: string },
) {
  if (!hasPrismaDelegate("rFQEvent")) return;
  try {
    await prisma.rFQEvent.create({
      data: {
        rfqId,
        eventType,
        title,
        detail: opts?.detail ?? null,
        userId: opts?.userId ?? null,
        vendorId: opts?.vendorId ?? null,
      },
    });
  } catch {
    /* schema migrating */
  }
}

const createRfqSchema = z.object({
  title: z.string().min(3),
  productName: z.string().optional(),
  quantity: z.coerce.number().positive().optional(),
  unit: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  budgetAmount: z.coerce.number().positive().optional(),
  baselinePrice: z.coerce.number().positive().optional(),
  specTamarindGrade: z.nativeEnum(TamarindGrade).optional(),
  specMoistureMaxPct: z.coerce.number().optional(),
  specPulpYieldMinPct: z.coerce.number().optional(),
  specAcidityMin: z.coerce.number().optional(),
  packagingRequirements: z.string().optional(),
  moqRequired: z.coerce.number().positive().optional(),
  sourcingType: z.enum(["COMMERCIAL", "FPO", "FARMER_DIRECT", "MIXED"]).optional(),
  auctionMode: z.enum(["STANDARD", "REVERSE_AUCTION"]).optional(),
  seasonalWindow: z.string().optional(),
  vendorIds: z.array(z.string()).optional(),
});

export async function createRfq(
  data: z.infer<typeof createRfqSchema>,
): Promise<ActionResult<{ id: string }>> {
  const user = await requirePermission("purchases.create");
  const parsed = createRfqSchema.parse(data);

  const count = await prisma.procurementRFQ.count();
  const rfqNumber = `RFQ-2026-${String(count + 1).padStart(4, "0")}`;

  const rfq = await prisma.procurementRFQ.create({
    data: {
      rfqNumber,
      title: parsed.title,
      productName: parsed.productName || null,
      quantity: parsed.quantity ?? null,
      unit: parsed.unit || "kg",
      dueDate: parsed.dueDate ? new Date(parsed.dueDate) : null,
      notes: parsed.notes || null,
      budgetAmount: parsed.budgetAmount ?? null,
      baselinePrice: parsed.baselinePrice ?? null,
      specTamarindGrade: parsed.specTamarindGrade ?? null,
      specMoistureMaxPct: parsed.specMoistureMaxPct ?? null,
      specPulpYieldMinPct: parsed.specPulpYieldMinPct ?? null,
      specAcidityMin: parsed.specAcidityMin ?? null,
      packagingRequirements: parsed.packagingRequirements || null,
      moqRequired: parsed.moqRequired ?? null,
      sourcingType: parsed.sourcingType ?? "COMMERCIAL",
      auctionMode: parsed.auctionMode ?? "STANDARD",
      seasonalWindow: parsed.seasonalWindow || null,
      status: RFQStatus.DRAFT,
      createdById: user.id,
      invitations: parsed.vendorIds?.length
        ? { create: parsed.vendorIds.map((vendorId) => ({ vendorId })) }
        : undefined,
    },
  });

  await logRfqEvent(rfq.id, "CREATED", `RFQ ${rfqNumber} drafted`, { userId: user.id });
  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.CREATE,
    entityType: "ProcurementRFQ",
    entityId: rfq.id,
    message: `Created RFQ ${rfqNumber}`,
  });

  revalidatePath("/procurement/rfq");
  return actionOk({ id: rfq.id });
}

export async function sendRfq(rfqId: string): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  const rfq = await prisma.procurementRFQ.findUnique({
    where: { id: rfqId },
    include: { invitations: true },
  });
  if (!rfq || rfq.status !== "DRAFT") return actionFail("RFQ must be in Draft to send");

  const now = new Date();
  await prisma.procurementRFQ.update({
    where: { id: rfqId },
    data: { status: "SENT", sentAt: now },
  });

  if (rfq.invitations.length) {
    await prisma.rFQVendorInvitation.updateMany({
      where: { rfqId, sentAt: null },
      data: { sentAt: now },
    });
  }

  await logRfqEvent(rfqId, "SENT", "RFQ sent to invited vendors", { userId: user.id });
  revalidatePath(`/procurement/rfq/${rfqId}`);
  revalidatePath("/procurement/rfq");
  return actionOk(undefined);
}

const quoteSchema = z.object({
  vendorId: z.string(),
  unitPrice: z.coerce.number().positive(),
  deliveryDays: z.coerce.number().int().positive().optional(),
  moq: z.coerce.number().positive().optional(),
  moisturePct: z.coerce.number().optional(),
  pulpYieldPct: z.coerce.number().optional(),
  acidityPct: z.coerce.number().optional(),
  tamarindGrade: z.nativeEnum(TamarindGrade).optional(),
  packagingNotes: z.string().optional(),
  notes: z.string().optional(),
});

export async function submitVendorQuote(
  rfqId: string,
  data: z.infer<typeof quoteSchema>,
): Promise<ActionResult> {
  await requirePermission("purchases.edit");
  const parsed = quoteSchema.parse(data);

  const rfq = await prisma.procurementRFQ.findUnique({ where: { id: rfqId } });
  if (!rfq || !["SENT", "QUOTED", "COMPARED"].includes(rfq.status)) {
    return actionFail("RFQ is not open for quotes");
  }

  const qty = rfq.quantity != null ? toNumber(rfq.quantity) : 1;
  const totalPrice = parsed.unitPrice * qty;
  const sentAt = rfq.sentAt ?? new Date();
  const responseHours = Math.max(1, Math.round((Date.now() - sentAt.getTime()) / 3600000));

  const vendor = await prisma.vendor.findUnique({
    where: { id: parsed.vendorId },
    select: { qualityScore: true, deliveryScore: true, name: true },
  });

  await prisma.vendorRFQQuote.upsert({
    where: { rfqId_vendorId: { rfqId, vendorId: parsed.vendorId } },
    create: {
      rfqId,
      vendorId: parsed.vendorId,
      unitPrice: parsed.unitPrice,
      totalPrice,
      deliveryDays: parsed.deliveryDays ?? null,
      moq: parsed.moq ?? null,
      moisturePct: parsed.moisturePct ?? null,
      pulpYieldPct: parsed.pulpYieldPct ?? null,
      acidityPct: parsed.acidityPct ?? null,
      tamarindGrade: parsed.tamarindGrade ?? null,
      packagingNotes: parsed.packagingNotes || null,
      notes: parsed.notes || null,
      qualityScore: vendor?.qualityScore ?? null,
      responseHours,
      quotedAt: new Date(),
    },
    update: {
      unitPrice: parsed.unitPrice,
      totalPrice,
      deliveryDays: parsed.deliveryDays ?? null,
      moq: parsed.moq ?? null,
      moisturePct: parsed.moisturePct ?? null,
      pulpYieldPct: parsed.pulpYieldPct ?? null,
      acidityPct: parsed.acidityPct ?? null,
      tamarindGrade: parsed.tamarindGrade ?? null,
      packagingNotes: parsed.packagingNotes || null,
      notes: parsed.notes || null,
      responseHours,
      quotedAt: new Date(),
    },
  });

  await prisma.rFQVendorInvitation.updateMany({
    where: { rfqId, vendorId: parsed.vendorId },
    data: { respondedAt: new Date() },
  });

  const quoteCount = await prisma.vendorRFQQuote.count({ where: { rfqId } });
  if (quoteCount >= 1 && rfq.status === "SENT") {
    await prisma.procurementRFQ.update({
      where: { id: rfqId },
      data: { status: "QUOTED" },
    });
  }

  await logRfqEvent(rfqId, "QUOTE_RECEIVED", `Quote from ${vendor?.name ?? "vendor"}`, {
    vendorId: parsed.vendorId,
    detail: `Unit price ₹${parsed.unitPrice}`,
  });

  revalidatePath(`/procurement/rfq/${rfqId}`);
  return actionOk(undefined);
}

export async function startRfqComparison(rfqId: string): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  const rfq = await prisma.procurementRFQ.findUnique({ where: { id: rfqId }, include: { quotes: true } });
  if (!rfq?.quotes.length) return actionFail("At least one vendor quote is required");

  const matrix = await compareRfqQuotes(rfqId);
  const top = matrix[0];

  await prisma.procurementRFQ.update({
    where: { id: rfqId },
    data: {
      status: "COMPARED",
      comparisonStartedAt: new Date(),
      aiRecommendedVendorId: top?.vendorId ?? null,
    },
  });

  await logRfqEvent(rfqId, "COMPARISON_STARTED", "Quote comparison matrix opened", { userId: user.id });
  revalidatePath(`/procurement/rfq/${rfqId}`);
  return actionOk(undefined);
}

export async function approveRfqVendor(
  rfqId: string,
  quoteId: string,
): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  const quote = await prisma.vendorRFQQuote.findFirst({
    where: { id: quoteId, rfqId },
    include: { vendor: true, rfq: true },
  });
  if (!quote) return actionFail("Quote not found");
  if (quote.rfq.status !== "COMPARED") return actionFail("RFQ must be under comparison");

  await prisma.procurementRFQ.update({
    where: { id: rfqId },
    data: { status: "APPROVED", approvedAt: new Date() },
  });

  await logRfqEvent(rfqId, "APPROVED", `Award approved for ${quote.vendor.name}`, {
    userId: user.id,
    vendorId: quote.vendorId,
  });

  revalidatePath(`/procurement/rfq/${rfqId}`);
  return actionOk(undefined);
}

export async function awardRfqVendor(
  rfqId: string,
  quoteId: string,
): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  const quote = await prisma.vendorRFQQuote.findFirst({
    where: { id: quoteId, rfqId },
    include: { vendor: true, rfq: true },
  });
  if (!quote) return actionFail("Quote not found");

  await prisma.$transaction([
    prisma.vendorRFQQuote.updateMany({ where: { rfqId }, data: { isSelected: false } }),
    prisma.vendorRFQQuote.update({ where: { id: quoteId }, data: { isSelected: true } }),
    prisma.procurementRFQ.update({
      where: { id: rfqId },
      data: {
        status: "AWARDED",
        awardedVendorId: quote.vendorId,
        awardedAt: new Date(),
      },
    }),
  ]);

  await logRfqEvent(rfqId, "AWARDED", `Contract awarded to ${quote.vendor.name}`, {
    userId: user.id,
    vendorId: quote.vendorId,
  });

  revalidatePath(`/procurement/rfq/${rfqId}`);
  revalidatePath("/procurement/rfq");
  return actionOk(undefined);
}

export async function createPurchaseOrderFromRfq(rfqId: string): Promise<ActionResult<{ purchaseId: string }>> {
  const user = await requirePermission("purchases.create");
  const rfq = await prisma.procurementRFQ.findUnique({
    where: { id: rfqId },
    include: {
      quotes: { where: { isSelected: true }, include: { vendor: true } },
      purchases: { take: 1 },
    },
  });

  if (!rfq) return actionFail("RFQ not found");
  if (rfq.purchases.length) return actionOk({ purchaseId: rfq.purchases[0].id });
  if (!rfq.quotes.length) return actionFail("Award a vendor before creating PO");

  const quote = rfq.quotes[0];
  const product = await prisma.product.findFirst({
    where: { name: { contains: rfq.productName?.split(" ")[0] ?? "Tamarind", mode: "insensitive" } },
  });
  if (!product) return actionFail("Matching product not found — create product in inventory first");

  const qty = rfq.quantity != null ? toNumber(rfq.quantity) : 1;
  const line = calculateLine(product, qty, toNumber(quote.unitPrice), "costPrice");
  const { subtotal, gstAmount, total } = sumLines([line]);
  const count = await prisma.purchase.count();
  const purchaseNumber = `PO-2026-${String(count + 1).padStart(4, "0")}`;

  const purchase = await prisma.$transaction(async (tx) => {
    const po = await tx.purchase.create({
      data: {
        purchaseNumber,
        vendorId: quote.vendorId,
        userId: user.id,
        rfqId,
        subtotal,
        gstAmount,
        total,
        budgetAmount: rfq.budgetAmount,
        poStatus: "DRAFT",
        procurementStage: "DRAFT",
        approvalStatus: "PENDING",
        notes: `Generated from ${rfq.rfqNumber}`,
        items: {
          create: [
            {
              productId: product.id,
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              gstPercent: line.gstPercent,
              gstAmount: line.gstAmount,
              lineTotal: line.lineTotal,
              tamarindGrade: quote.tamarindGrade,
              moisturePct: quote.moisturePct,
              expectedYieldPct: rfq.specPulpYieldMinPct,
            },
          ],
        },
      },
    });
    return po;
  });

  await ensurePurchaseApprovals(purchase.id);
  await logRfqEvent(rfqId, "PO_CREATED", `PO ${purchaseNumber} created`, { userId: user.id });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.CREATE,
    entityType: "Purchase",
    entityId: purchase.id,
    message: `PO from RFQ ${rfq.rfqNumber}`,
  });

  revalidatePath(`/procurement/rfq/${rfqId}`);
  revalidatePath("/purchases");
  return actionOk({ purchaseId: purchase.id });
}

export async function submitCounterOffer(
  quoteId: string,
  unitPrice: number,
  notes?: string,
): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  const quote = await prisma.vendorRFQQuote.findUnique({
    where: { id: quoteId },
    include: { rfq: true, vendor: true },
  });
  if (!quote) return actionFail("Quote not found");

  const round =
    (await prisma.rFQNegotiation.count({ where: { quoteId } })) + 1;

  await prisma.$transaction([
    prisma.vendorRFQQuote.update({
      where: { id: quoteId },
      data: { counterOfferPrice: unitPrice, counterOfferAt: new Date() },
    }),
    prisma.rFQNegotiation.create({
      data: {
        rfqId: quote.rfqId,
        quoteId,
        round,
        offeredBy: "BUYER",
        unitPrice,
        notes: notes || null,
      },
    }),
  ]);

  await logRfqEvent(quote.rfqId, "COUNTER_OFFER", `Counter-offer to ${quote.vendor.name}: ₹${unitPrice}/unit`, {
    userId: user.id,
    vendorId: quote.vendorId,
    detail: notes,
  });

  revalidatePath(`/procurement/rfq/${quote.rfqId}`);
  return actionOk(undefined);
}

export async function closeRfq(rfqId: string): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  await prisma.procurementRFQ.update({
    where: { id: rfqId },
    data: { status: "CLOSED", closedAt: new Date() },
  });
  await logRfqEvent(rfqId, "CLOSED", "RFQ closed", { userId: user.id });
  revalidatePath(`/procurement/rfq/${rfqId}`);
  revalidatePath("/procurement/rfq");
  return actionOk(undefined);
}

export async function cancelRfq(rfqId: string): Promise<ActionResult> {
  const user = await requirePermission("purchases.edit");
  await prisma.procurementRFQ.update({
    where: { id: rfqId },
    data: { status: "CANCELLED" },
  });
  await logRfqEvent(rfqId, "CANCELLED", "RFQ cancelled", { userId: user.id });
  revalidatePath(`/procurement/rfq/${rfqId}`);
  revalidatePath("/procurement/rfq");
  return actionOk(undefined);
}

/** Simulate reverse-auction bid (lower unit price). */
export async function submitReverseAuctionBid(
  rfqId: string,
  vendorId: string,
  unitPrice: number,
): Promise<ActionResult> {
  await requirePermission("purchases.edit");
  const rfq = await prisma.procurementRFQ.findUnique({ where: { id: rfqId } });
  if (!rfq || rfq.auctionMode !== "REVERSE_AUCTION") {
    return actionFail("RFQ is not in reverse auction mode");
  }

  const result = await submitVendorQuote(rfqId, { vendorId, unitPrice });
  if (!result.ok) return result;

  await logRfqEvent(rfqId, "AUCTION_BID", `Reverse auction bid ₹${unitPrice}`, { vendorId });
  revalidatePath(`/procurement/rfq/${rfqId}`);
  return actionOk(undefined);
}
