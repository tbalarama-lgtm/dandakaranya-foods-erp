"use server";

import { revalidatePath } from "next/cache";
import {
  ActivityAction,
  CreditNoteStatus,
  InvoiceStatus,
  PaymentMethod,
  PaymentStatus,
  QuotationTaxMode,
  StockMovementType,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { requirePermission } from "@/lib/session";
import { calculateInvoiceLine, sumInvoiceLines, type InvoiceLineInput } from "@/lib/invoice-tax";
import {
  deriveInvoiceStatus,
  syncLegacyPaymentStatus,
} from "@/lib/invoice-types";
import { recalculateInvoicePaymentState } from "@/lib/invoice-metrics";
import { toNumber } from "@/lib/utils";

const lineSchema = z.object({
  productId: z.string(),
  quantity: z.coerce.number().positive(),
  unitPrice: z.coerce.number().optional(),
  discountPercent: z.coerce.number().min(0).max(100).optional(),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  packagingNotes: z.string().optional(),
  warehouseId: z.string().optional(),
});

const createInvoiceSchema = z.object({
  customerId: z.string(),
  lines: z.array(lineSchema).min(1),
  notes: z.string().optional(),
  internalNotes: z.string().optional(),
  taxMode: z.nativeEnum(QuotationTaxMode).optional(),
  currency: z.string().optional(),
  exchangeRate: z.coerce.number().optional(),
  discountAmount: z.coerce.number().optional(),
  shippingAmount: z.coerce.number().optional(),
  dueDays: z.coerce.number().optional(),
  warehouseId: z.string().optional(),
  salesOrderId: z.string().optional(),
  quotationId: z.string().optional(),
  templateKey: z.string().optional(),
  incoterms: z.string().optional(),
  customsReference: z.string().optional(),
  shippingDocRef: z.string().optional(),
  eInvoiceIrn: z.string().optional(),
  eWayBillNumber: z.string().optional(),
  deductStock: z.boolean().optional(),
  status: z.nativeEnum(InvoiceStatus).optional(),
});

function revalidateSales(id?: string) {
  revalidatePath("/sales");
  revalidatePath("/sales/orders");
  revalidatePath("/customers");
  revalidatePath("/");
  if (id) revalidatePath(`/sales/${id}`);
}

async function nextInvoiceNumber() {
  const count = await prisma.saleInvoice.count();
  return `INV-2026-${String(count + 1).padStart(4, "0")}`;
}

async function deductStockForLines(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  lines: ReturnType<typeof calculateInvoiceLine>[],
  productMap: Record<string, { warehouseId: string | null; name: string }>,
  reference: string,
  customerName: string,
  warehouseId?: string | null,
) {
  for (const line of lines) {
    const product = productMap[line.productId];
    if (!product) continue;
    const wh = line.warehouseId ?? warehouseId ?? product.warehouseId;
    await tx.product.update({
      where: { id: line.productId },
      data: { stockQty: { decrement: line.quantity } },
    });
    await tx.stockMovement.create({
      data: {
        productId: line.productId,
        warehouseId: wh,
        type: StockMovementType.OUT,
        quantity: line.quantity,
        reference,
        notes: `Sale to ${customerName}`,
      },
    });
  }
}

function mapLinesToItemCreate(lines: ReturnType<typeof calculateInvoiceLine>[]) {
  return lines.map((line) => ({
    productId: line.productId,
    warehouseId: line.warehouseId ?? null,
    sku: line.sku ?? null,
    hsnCode: line.hsnCode ?? null,
    quantity: line.quantity,
    unitPrice: line.unitPrice,
    discountPercent: line.discountPercent ?? 0,
    discountAmount: line.discountAmount ?? 0,
    gstPercent: line.gstPercent,
    cgstAmount: line.cgstAmount,
    sgstAmount: line.sgstAmount,
    igstAmount: line.igstAmount,
    gstAmount: line.cgstAmount + line.sgstAmount + line.igstAmount,
    lineTotal: line.lineTotal,
    batchNumber: line.batchNumber ?? null,
    expiryDate: line.expiryDate ?? null,
    packagingNotes: line.packagingNotes ?? null,
  }));
}

export async function createInvoice(data: z.infer<typeof createInvoiceSchema>) {
  const user = await requirePermission("sales.create");
  const parsed = createInvoiceSchema.parse(data);

  const customer = await prisma.customer.findUniqueOrThrow({ where: { id: parsed.customerId } });
  const productIds = [...new Set(parsed.lines.map((l) => l.productId))];
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));
  const taxMode = parsed.taxMode ?? "DOMESTIC";

  const lines = parsed.lines.map((line) => {
    const product = productMap[line.productId];
    if (!product) throw new Error(`Product not found: ${line.productId}`);
    return calculateInvoiceLine(product, line, taxMode);
  });

  const totals = sumInvoiceLines(lines, parsed.shippingAmount ?? 0, parsed.discountAmount ?? 0);
  const invoiceNumber = await nextInvoiceNumber();
  const status = parsed.status ?? "DRAFT";
  const shouldDeduct = parsed.deductStock !== false && status !== "DRAFT";

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.saleInvoice.create({
      data: {
        invoiceNumber,
        customerId: customer.id,
        userId: user.id,
        warehouseId: parsed.warehouseId || null,
        salesOrderId: parsed.salesOrderId || null,
        quotationId: parsed.quotationId || null,
        subtotal: totals.subtotal,
        discountAmount: totals.discountAmount,
        shippingAmount: totals.shippingAmount,
        gstAmount: totals.gstAmount,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        total: totals.total,
        status,
        paymentStatus: syncLegacyPaymentStatus(status),
        taxMode,
        currency: parsed.currency ?? "INR",
        exchangeRate: parsed.exchangeRate ?? null,
        dueDate: new Date(Date.now() + (parsed.dueDays ?? 30) * 86400000),
        notes: parsed.notes || null,
        internalNotes: parsed.internalNotes || null,
        incoterms: parsed.incoterms || null,
        customsReference: parsed.customsReference || null,
        shippingDocRef: parsed.shippingDocRef || null,
        eInvoiceIrn: parsed.eInvoiceIrn || null,
        eWayBillNumber: parsed.eWayBillNumber || null,
        templateKey: parsed.templateKey ?? "standard",
        stockDeducted: shouldDeduct,
        items: { create: mapLinesToItemCreate(lines) },
      },
    });

    if (shouldDeduct) {
      await deductStockForLines(
        tx,
        lines,
        productMap,
        invoiceNumber,
        customer.name,
        parsed.warehouseId,
      );
    }

    return inv;
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.CREATE,
    entityType: "SaleInvoice",
    entityId: invoice.id,
    message: `Created invoice ${invoiceNumber} for ${customer.name}`,
  });

  revalidateSales(invoice.id);
  revalidatePath("/inventory");
  return invoice;
}

export async function updateInvoiceStatus(id: string, status: InvoiceStatus) {
  const user = await requirePermission("sales.edit");
  const data: Record<string, unknown> = {
    status,
    paymentStatus: syncLegacyPaymentStatus(status),
  };
  if (status === "SENT") data.sentAt = new Date();
  if (status === "VIEWED") data.viewedAt = new Date();
  if (status === "PAID") data.paidAt = new Date();
  if (status === "CANCELLED") data.cancelledAt = new Date();

  await prisma.saleInvoice.update({ where: { id }, data });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.UPDATE,
    entityType: "SaleInvoice",
    entityId: id,
    message: `Invoice status → ${status}`,
  });

  revalidateSales(id);
}

/** @deprecated Use updateInvoiceStatus */
export async function updateInvoicePaymentStatus(id: string, paymentStatus: PaymentStatus) {
  const statusMap: Record<PaymentStatus, InvoiceStatus> = {
    PENDING: "SENT",
    PARTIAL: "PARTIALLY_PAID",
    PAID: "PAID",
    OVERDUE: "OVERDUE",
    CANCELLED: "CANCELLED",
  };
  return updateInvoiceStatus(id, statusMap[paymentStatus]);
}

export async function sendInvoice(id: string, channel: "email" | "whatsapp", toAddress: string) {
  const user = await requirePermission("sales.edit");
  const inv = await prisma.saleInvoice.findUniqueOrThrow({
    where: { id },
    include: { customer: true },
  });

  await prisma.invoiceReminderLog.create({
    data: { invoiceId: id, channel, toAddress, status: "SENT" },
  });

  if (inv.status === "DRAFT") {
    await prisma.saleInvoice.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date(), paymentStatus: "PENDING" },
    });
  }

  await logActivity({
    userId: user.id,
    action: ActivityAction.CREATE,
    entityType: "InvoiceReminder",
    entityId: id,
    message: `Invoice reminder via ${channel} to ${toAddress}`,
  });

  revalidateSales(id);

  const subject = encodeURIComponent(`Invoice ${inv.invoiceNumber} — Dandakaranya Foods`);
  const body = encodeURIComponent(
    `Dear ${inv.customer.name},\n\nPlease find invoice ${inv.invoiceNumber} for ₹${toNumber(inv.total).toLocaleString("en-IN")}.\n\nView PDF: ${process.env.NEXT_PUBLIC_APP_URL ?? ""}/api/invoices/${id}/pdf`,
  );

  if (channel === "email") {
    return { ok: true, href: `mailto:${toAddress}?subject=${subject}&body=${body}` };
  }
  const phone = toAddress.replace(/\D/g, "");
  return { ok: true, href: `https://wa.me/${phone}?text=${body}` };
}

export async function recordInvoicePayment(
  invoiceId: string,
  data: {
    amount: number;
    paymentMode?: PaymentMethod;
    utr?: string;
    reference?: string;
    notes?: string;
    reconciled?: boolean;
  },
) {
  const user = await requirePermission("sales.edit");
  const inv = await prisma.saleInvoice.findUniqueOrThrow({ where: { id: invoiceId } });

  await prisma.payment.create({
    data: {
      saleId: invoiceId,
      amount: data.amount,
      paymentMode: data.paymentMode ?? "BANK_TRANSFER",
      method: data.paymentMode ?? "BANK_TRANSFER",
      utr: data.utr || null,
      reference: data.reference || data.utr || null,
      notes: data.notes || null,
      reconciled: data.reconciled ?? false,
    },
  });

  await recalculateInvoicePaymentState(invoiceId);

  await logActivity({
    userId: user.id,
    action: ActivityAction.CREATE,
    entityType: "Payment",
    entityId: invoiceId,
    message: `Payment ₹${data.amount} recorded on ${inv.invoiceNumber}`,
  });

  revalidateSales(invoiceId);
  revalidatePath(`/customers/${inv.customerId}`);
}

export async function reconcilePayment(paymentId: string, reconciled: boolean) {
  await requirePermission("sales.edit");
  await prisma.payment.update({ where: { id: paymentId }, data: { reconciled } });
  const payment = await prisma.payment.findUniqueOrThrow({ where: { id: paymentId } });
  if (payment.saleId) {
    await recalculateInvoicePaymentState(payment.saleId);
    revalidateSales(payment.saleId);
  }
}

export async function updateGstCompliance(
  id: string,
  data: { eInvoiceIrn?: string; eWayBillNumber?: string },
) {
  await requirePermission("sales.edit");
  await prisma.saleInvoice.update({ where: { id }, data });
  revalidateSales(id);
}

export async function convertOrderToInvoice(orderId: string) {
  const user = await requirePermission("sales.create");

  const order = await prisma.salesOrder.findUniqueOrThrow({
    where: { id: orderId },
    include: { items: { include: { product: true } }, customer: true, invoice: true },
  });

  if (order.invoice) {
    return { invoiceId: order.invoice.id, invoiceNumber: order.invoice.invoiceNumber };
  }

  const invoiceNumber = await nextInvoiceNumber();
  const taxMode: QuotationTaxMode = "DOMESTIC";

  const lines = order.items.map((item) =>
    calculateInvoiceLine(
      item.product,
      {
        productId: item.productId,
        quantity: toNumber(item.quantity),
        unitPrice: toNumber(item.unitPrice),
      },
      taxMode,
    ),
  );

  const totals = sumInvoiceLines(lines);

  const invoice = await prisma.$transaction(async (tx) => {
    const inv = await tx.saleInvoice.create({
      data: {
        invoiceNumber,
        customerId: order.customerId,
        userId: user.id,
        branchId: order.branchId,
        warehouseId: order.warehouseId,
        salesOrderId: order.id,
        quotationId: order.quotationId,
        subtotal: totals.subtotal,
        gstAmount: totals.gstAmount,
        cgstAmount: totals.cgstAmount,
        sgstAmount: totals.sgstAmount,
        igstAmount: totals.igstAmount,
        total: totals.total,
        status: "SENT",
        paymentStatus: "PENDING",
        sentAt: new Date(),
        taxMode,
        dueDate: new Date(Date.now() + 30 * 86400000),
        notes: order.notes ? `From order ${order.orderNumber}. ${order.notes}` : `From order ${order.orderNumber}`,
        stockDeducted: true,
        items: { create: mapLinesToItemCreate(lines) },
      },
    });

    const productMap = Object.fromEntries(order.items.map((i) => [i.productId, i.product]));
    await deductStockForLines(tx, lines, productMap, invoiceNumber, order.customer.name, order.warehouseId);

    return inv;
  });

  await logActivity({
    userId: user.id,
    userName: user.name,
    action: ActivityAction.CREATE,
    entityType: "SaleInvoice",
    entityId: invoice.id,
    message: `Converted ${order.orderNumber} → ${invoiceNumber}`,
  });

  revalidateSales(invoice.id);
  if (order.leadId) revalidatePath(`/leads/${order.leadId}`);
  return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
}

export async function createCreditNote(
  invoiceId: string,
  data: { reason: string; lines: { productId: string; quantity: number; unitPrice?: number }[] },
) {
  const user = await requirePermission("sales.create");
  const invoice = await prisma.saleInvoice.findUniqueOrThrow({
    where: { id: invoiceId },
    include: { items: { include: { product: true } } },
  });

  const productIds = data.lines.map((l) => l.productId);
  const products = await prisma.product.findMany({ where: { id: { in: productIds } } });
  const productMap = Object.fromEntries(products.map((p) => [p.id, p]));

  const lines = data.lines.map((line) => {
    const product = productMap[line.productId];
    if (!product) throw new Error("Product not found");
    return calculateInvoiceLine(product, line, invoice.taxMode);
  });

  const totals = sumInvoiceLines(lines);
  const count = await prisma.creditNote.count();
  const creditNoteNumber = `CN-2026-${String(count + 1).padStart(4, "0")}`;

  const cn = await prisma.creditNote.create({
    data: {
      creditNoteNumber,
      invoiceId,
      customerId: invoice.customerId,
      userId: user.id,
      subtotal: totals.subtotal,
      gstAmount: totals.gstAmount,
      total: totals.total,
      reason: data.reason,
      items: lines,
      status: "ISSUED",
      issuedAt: new Date(),
    },
  });

  await prisma.saleInvoice.update({
    where: { id: invoiceId },
    data: { status: "REFUNDED", paymentStatus: "CANCELLED", cancelledAt: new Date() },
  });

  await logActivity({
    userId: user.id,
    action: ActivityAction.CREATE,
    entityType: "CreditNote",
    entityId: cn.id,
    message: `Credit note ${creditNoteNumber} for ${invoice.invoiceNumber}`,
  });

  revalidateSales(invoiceId);
  return cn;
}

export async function createRecurringInvoice(data: {
  name: string;
  customerId: string;
  frequency: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
  templateData: object;
}) {
  const user = await requirePermission("sales.create");
  const days =
    data.frequency === "WEEKLY"
      ? 7
      : data.frequency === "MONTHLY"
        ? 30
        : data.frequency === "QUARTERLY"
          ? 90
          : 365;

  return prisma.recurringInvoice.create({
    data: {
      name: data.name,
      customerId: data.customerId,
      userId: user.id,
      frequency: data.frequency,
      nextRunAt: new Date(Date.now() + days * 86400000),
      templateData: data.templateData,
    },
  });
}

export async function markInvoiceViewed(id: string) {
  const inv = await prisma.saleInvoice.findUniqueOrThrow({ where: { id } });
  if (inv.status === "SENT") {
    await prisma.saleInvoice.update({
      where: { id },
      data: { status: "VIEWED", viewedAt: new Date() },
    });
    revalidateSales(id);
  }
}

/** @deprecated Use createInvoice with lines */
export async function createSimpleInvoice(data: {
  customerId: string;
  productId: string;
  quantity: number;
  unitPrice?: number;
}) {
  return createInvoice({
    customerId: data.customerId,
    lines: [{ productId: data.productId, quantity: data.quantity, unitPrice: data.unitPrice }],
  });
}
