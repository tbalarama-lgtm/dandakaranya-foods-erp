"use server";

import { revalidatePath } from "next/cache";
import {
  ActivityAction,
  CommunicationChannel,
  LeadStage,
  OrderStatus,
  QuotationStatus,
  QuotationTaxMode,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/session";
import { calculateQuoteLine, requiresPricingApproval, sumQuoteLines } from "@/lib/quotation-tax";
import { isQuoteConvertible } from "@/lib/quotation-types";
import { toNumber } from "@/lib/utils";

const lineSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().optional(),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
});

const quoteSchema = z.object({
  customerId: z.string().optional(),
  leadId: z.string().optional(),
  lines: z.array(lineSchema).min(1),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  taxMode: z.nativeEnum(QuotationTaxMode).optional(),
  currency: z.string().optional(),
  exchangeRate: z.coerce.number().optional(),
  discountAmount: z.coerce.number().optional(),
  shippingAmount: z.coerce.number().optional(),
  validDays: z.coerce.number().optional(),
  incoterms: z.string().optional(),
  pricingTerms: z.string().optional(),
  moq: z.string().optional(),
  packagingConfig: z.string().optional(),
  containerQty: z.string().optional(),
  shelfLife: z.string().optional(),
  templateKey: z.string().optional(),
});

function revalidateQuotes() {
  revalidatePath("/quotations");
  revalidatePath("/leads");
}

async function nextQuoteNumber(revision = 1) {
  const count = await prisma.quotation.count();
  const base = `QT-2026-${String(count + 1).padStart(4, "0")}`;
  return revision > 1 ? `${base}-R${revision}` : base;
}

export async function createQuotation(data: z.infer<typeof quoteSchema>) {
  const user = await requirePermission("sales.create");
  const parsed = quoteSchema.parse(data);

  const productIds = parsed.lines.map((l) => l.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const taxMode = parsed.taxMode ?? "DOMESTIC";

  const lines = parsed.lines.map((line) => {
    const product = products.find((p) => p.id === line.productId);
    if (!product) throw new Error(`Product not found: ${line.productId}`);
    return calculateQuoteLine(product, line, taxMode);
  });

  const totals = sumQuoteLines(lines, parsed.shippingAmount ?? 0, parsed.discountAmount ?? 0);
  const needsApproval = requiresPricingApproval(lines, products);

  const quote = await prisma.quotation.create({
    data: {
      quoteNumber: await nextQuoteNumber(),
      customerId: parsed.customerId || null,
      leadId: parsed.leadId || null,
      userId: user.id,
      items: lines,
      subtotal: totals.subtotal,
      discountAmount: totals.discountAmount,
      shippingAmount: totals.shippingAmount,
      gstAmount: totals.gstAmount,
      cgstAmount: totals.cgstAmount,
      sgstAmount: totals.sgstAmount,
      igstAmount: totals.igstAmount,
      total: totals.total,
      status: needsApproval ? "UNDER_REVIEW" : "DRAFT",
      taxMode,
      currency: parsed.currency ?? "INR",
      exchangeRate: parsed.exchangeRate ?? null,
      validUntil: new Date(Date.now() + (parsed.validDays ?? 30) * 86400000),
      notes: parsed.notes || null,
      internalNotes: parsed.internalNotes || null,
      incoterms: parsed.incoterms || null,
      pricingTerms: parsed.pricingTerms || null,
      moq: parsed.moq || null,
      packagingConfig: parsed.packagingConfig || null,
      containerQty: parsed.containerQty || null,
      shelfLife: parsed.shelfLife || null,
      templateKey: parsed.templateKey ?? "standard",
      requiresApproval: needsApproval,
    },
  });

  if (needsApproval) {
    await prisma.quotationApproval.create({
      data: {
        quotationId: quote.id,
        requestedBy: user.id,
        reason: "Pricing exception — discount or below-list pricing detected",
      },
    });
  }

  if (parsed.leadId) {
    await prisma.lead.update({
      where: { id: parsed.leadId },
      data: { stage: LeadStage.PROPOSAL_SENT, value: totals.total },
    });
  }

  await logActivity({
    userId: user.id,
    action: ActivityAction.CREATE,
    entityType: "Quotation",
    entityId: quote.id,
    message: `Created quotation ${quote.quoteNumber}`,
  });

  revalidateQuotes();
  return quote;
}

export async function updateQuotationStatus(id: string, status: QuotationStatus) {
  const user = await requirePermission("sales.edit");
  const data: Record<string, unknown> = { status };
  if (status === "SENT") data.sentAt = new Date();
  if (status === "APPROVED" || status === "ACCEPTED") data.approvedAt = new Date();
  if (status === "EXPIRED") data.expiredAt = new Date();

  await prisma.quotation.update({ where: { id }, data });

  await logActivity({
    userId: user.id,
    action: ActivityAction.UPDATE,
    entityType: "Quotation",
    entityId: id,
    message: `Quotation status → ${status}`,
  });

  revalidateQuotes();
  revalidatePath(`/quotations/${id}`);
}

export async function sendQuotationEmail(id: string, toEmail: string, subject: string) {
  const user = await requirePermission("sales.edit");

  await prisma.quotationEmailLog.create({
    data: { quotationId: id, toEmail, subject, status: "SENT" },
  });

  const quote = await prisma.quotation.findUniqueOrThrow({ where: { id } });
  if (quote.status === "DRAFT") {
    await prisma.quotation.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
    });
  }

  await logActivity({
    userId: user.id,
    action: ActivityAction.CREATE,
    entityType: "QuotationEmail",
    entityId: id,
    message: `Quotation emailed to ${toEmail}`,
  });

  revalidateQuotes();
  revalidatePath(`/quotations/${id}`);
  return { ok: true, mailto: `mailto:${toEmail}?subject=${encodeURIComponent(subject)}` };
}

export async function approveQuotationPricing(quotationId: string, approve: boolean) {
  const user = await requirePermission("sales.edit");
  const pending = await prisma.quotationApproval.findFirst({
    where: { quotationId, status: "PENDING" },
    orderBy: { createdAt: "desc" },
  });
  if (!pending) throw new Error("No pending approval");

  await prisma.quotationApproval.update({
    where: { id: pending.id },
    data: {
      status: approve ? "APPROVED" : "REJECTED",
      approvedBy: user.id,
      resolvedAt: new Date(),
    },
  });

  await prisma.quotation.update({
    where: { id: quotationId },
    data: {
      status: approve ? "APPROVED" : "REJECTED",
      approvedAt: approve ? new Date() : undefined,
      requiresApproval: false,
    },
  });

  revalidateQuotes();
  revalidatePath(`/quotations/${quotationId}`);
}

export async function signQuotation(id: string, signatureName: string) {
  await requirePermission("sales.edit");
  await prisma.quotation.update({
    where: { id },
    data: {
      signatureName,
      signatureStatus: "SIGNED",
      signedAt: new Date(),
      status: "APPROVED",
      approvedAt: new Date(),
    },
  });
  revalidatePath(`/quotations/${id}`);
}

export async function createQuotationRevision(id: string) {
  const user = await requirePermission("sales.create");
  const original = await prisma.quotation.findUniqueOrThrow({ where: { id } });

  const revisionNumber = original.revisionNumber + 1;
  const quote = await prisma.quotation.create({
    data: {
      quoteNumber: await nextQuoteNumber(revisionNumber),
      customerId: original.customerId,
      leadId: original.leadId,
      userId: user.id,
      parentQuoteId: original.parentQuoteId ?? original.id,
      revisionNumber,
      items: original.items as object,
      subtotal: original.subtotal,
      discountAmount: original.discountAmount,
      shippingAmount: original.shippingAmount,
      gstAmount: original.gstAmount,
      cgstAmount: original.cgstAmount,
      sgstAmount: original.sgstAmount,
      igstAmount: original.igstAmount,
      total: original.total,
      status: "DRAFT",
      taxMode: original.taxMode,
      currency: original.currency,
      exchangeRate: original.exchangeRate,
      validUntil: new Date(Date.now() + 30 * 86400000),
      notes: original.notes,
      internalNotes: original.internalNotes,
      incoterms: original.incoterms,
      pricingTerms: original.pricingTerms,
      moq: original.moq,
      packagingConfig: original.packagingConfig,
      containerQty: original.containerQty,
      shelfLife: original.shelfLife,
      templateKey: original.templateKey,
    },
  });

  revalidateQuotes();
  return quote;
}

export async function convertQuotationToSalesOrder(quotationId: string) {
  const user = await requirePermission("sales.create");
  const quote = await prisma.quotation.findUniqueOrThrow({
    where: { id: quotationId },
    include: { lead: true },
  });

  if (!isQuoteConvertible(quote.status)) {
    throw new Error("Quotation is not in a convertible status");
  }

  let customerId = quote.customerId;
  if (!customerId && quote.lead) {
    const lead = quote.lead;
    let customer = await prisma.customer.findFirst({
      where: { OR: [{ email: lead.email ?? "" }, { name: lead.company }] },
    });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: lead.company,
          company: lead.company,
          phone: lead.phone,
          email: lead.email,
          country: lead.country,
          segment: "EXPORT",
        },
      });
    }
    customerId = customer.id;
  }

  if (!customerId) throw new Error("No customer linked to quotation");

  const items = quote.items as {
    productId: string;
    quantity: number;
    unitPrice: number;
    gstPercent: number;
    cgstAmount: number;
    sgstAmount: number;
    igstAmount: number;
    lineTotal: number;
  }[];

  const count = await prisma.salesOrder.count();
  const orderNumber = `SO-2026-${String(count + 1).padStart(4, "0")}`;

  const order = await prisma.salesOrder.create({
    data: {
      orderNumber,
      customerId,
      userId: user.id,
      leadId: quote.leadId,
      quotationId: quote.id,
      status: OrderStatus.CONFIRMED,
      subtotal: quote.subtotal,
      gstAmount: quote.gstAmount,
      total: quote.total,
      notes: `Converted from ${quote.quoteNumber}`,
      items: {
        create: items.map((line) => ({
          productId: line.productId,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          gstPercent: line.gstPercent,
          gstAmount: (line.cgstAmount ?? 0) + (line.sgstAmount ?? 0) + (line.igstAmount ?? 0),
          lineTotal: line.lineTotal,
        })),
      },
    },
  });

  await prisma.quotation.update({
    where: { id: quotationId },
    data: { status: "CONVERTED", convertedOrderId: order.id },
  });

  if (quote.leadId) {
    await prisma.lead.update({
      where: { id: quote.leadId },
      data: { stage: LeadStage.WON, convertedAt: new Date(), value: toNumber(quote.total) },
    });
    await prisma.leadCommunication.create({
      data: {
        leadId: quote.leadId,
        channel: CommunicationChannel.QUOTATION,
        message: `Converted ${quote.quoteNumber} → ${orderNumber}`,
        userId: user.id,
      },
    });
  }

  await logActivity({
    userId: user.id,
    action: ActivityAction.CREATE,
    entityType: "SalesOrder",
    entityId: order.id,
    message: `Converted ${quote.quoteNumber} → ${orderNumber}`,
  });

  revalidateQuotes();
  revalidatePath("/sales/orders");
  return { orderId: order.id, orderNumber };
}
