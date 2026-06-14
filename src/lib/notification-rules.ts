import {
  ActivityAction,
  NotificationCategory,
  NotificationSeverity,
  UserRole,
} from "@prisma/client";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import {
  getAdminUserIds,
  getUsersByRoles,
  upsertNotification,
} from "@/lib/notifications";
import type { NotificationActionDef } from "@/lib/notification-types";
import { toNumber } from "@/lib/utils";

const ESCALATION_MS = 24 * 60 * 60 * 1000;

type RuleTarget = { userId: string; role: UserRole };

async function notifyMany(
  targets: RuleTarget[],
  input: Omit<Parameters<typeof upsertNotification>[0], "userId">,
) {
  for (const t of targets) {
    await upsertNotification({ ...input, userId: t.userId });
  }
}

async function lowStockAlerts(targets: RuleTarget[]) {
  const products = await prisma.product.findMany({
    where: { minStockQty: { gt: 0 } },
    select: { id: true, name: true, stockQty: true, minStockQty: true },
  });

  for (const p of products) {
    const stock = toNumber(p.stockQty);
    const min = toNumber(p.minStockQty);
    if (stock > min) continue;

    const severity: NotificationSeverity = stock <= min * 0.5 ? "CRITICAL" : "WARNING";
    const actions: NotificationActionDef[] = [
      { type: "VIEW_DETAILS", label: "View inventory", href: "/inventory" },
      { type: "RESOLVE", label: "Resolve" },
    ];

    await notifyMany(targets.filter((t) => ["ADMIN", "MANAGER", "SALES_EXECUTIVE"].includes(t.role)), {
      title: "Low stock alert",
      message: `${p.name} is at ${stock} units (min ${min}). Reorder recommended.`,
      category: "INVENTORY",
      severity,
      link: "/inventory",
      entityType: "Product",
      entityId: p.id,
      ruleKey: `low-stock-${p.id}`,
      actions,
      metadata: { productName: p.name, stock, minStock: min },
    });
  }
}

async function purchaseApprovalAlerts(targets: RuleTarget[]) {
  const pending = await prisma.purchase.findMany({
    where: { approvalStatus: "PENDING" },
    select: { id: true, purchaseNumber: true, total: true, vendor: { select: { name: true } } },
    take: 20,
  });

  for (const pu of pending) {
    const actions: NotificationActionDef[] = [
      { type: "APPROVE", label: "Approve", href: `/purchases/${pu.id}` },
      { type: "REJECT", label: "Reject", href: `/purchases/${pu.id}` },
      { type: "VIEW_DETAILS", label: "View GRN", href: `/purchases/${pu.id}` },
    ];

    await notifyMany(targets.filter((t) => ["ADMIN", "MANAGER", "ACCOUNTANT"].includes(t.role)), {
      title: "Purchase approval required",
      message: `GRN ${pu.purchaseNumber} from ${pu.vendor.name} — ₹${toNumber(pu.total).toLocaleString("en-IN")} pending approval.`,
      category: "APPROVAL",
      severity: "WARNING",
      link: `/purchases/${pu.id}`,
      entityType: "Purchase",
      entityId: pu.id,
      ruleKey: `purchase-approval-${pu.id}`,
      actions,
    });
  }
}

async function overduePaymentAlerts(targets: RuleTarget[]) {
  const overdue = await prisma.saleInvoice.findMany({
    where: { paymentStatus: "OVERDUE" },
    select: { id: true, invoiceNumber: true, total: true, customer: { select: { name: true } } },
    take: 15,
  });

  for (const inv of overdue) {
    await notifyMany(targets.filter((t) => ["ADMIN", "MANAGER", "ACCOUNTANT"].includes(t.role)), {
      title: "Overdue payment",
      message: `Invoice ${inv.invoiceNumber} — ${inv.customer.name} owes ₹${toNumber(inv.total).toLocaleString("en-IN")}.`,
      category: "FINANCE",
      severity: "CRITICAL",
      link: `/sales/invoices/${inv.id}`,
      entityType: "SaleInvoice",
      entityId: inv.id,
      ruleKey: `overdue-${inv.id}`,
      actions: [
        { type: "VIEW_DETAILS", label: "View invoice", href: `/sales/invoices/${inv.id}` },
        { type: "RESOLVE", label: "Mark resolved" },
      ],
    });
  }
}

async function productionCompletionAlerts(targets: RuleTarget[]) {
  const recent = await prisma.productionBatch.findMany({
    where: {
      status: "COMPLETED",
      completedAt: { gte: new Date(Date.now() - 7 * 86400000) },
    },
    select: { id: true, batchCode: true, actualQty: true, recipe: { select: { name: true } } },
    take: 10,
  });

  for (const b of recent) {
    await notifyMany(targets.filter((t) => ["ADMIN", "MANAGER"].includes(t.role)), {
      title: "Production batch completed",
      message: `Batch ${b.batchCode} (${b.recipe.name}) — ${toNumber(b.actualQty)} units produced.`,
      category: "PRODUCTION",
      severity: "SUCCESS",
      link: "/production",
      entityType: "ProductionBatch",
      entityId: b.id,
      ruleKey: `prod-complete-${b.id}`,
      actions: [{ type: "VIEW_DETAILS", label: "View batch", href: "/production" }],
    });
  }
}

async function shipmentDelayAlerts(targets: RuleTarget[]) {
  const delayed = await prisma.salesOrder.findMany({
    where: {
      deliveryStatus: { in: ["PENDING", "IN_TRANSIT"] },
      status: { not: "CANCELLED" },
      createdAt: { lt: new Date(Date.now() - 3 * 86400000) },
    },
    select: { id: true, orderNumber: true, customer: { select: { name: true } } },
    take: 10,
  });

  for (const o of delayed) {
    await notifyMany(targets.filter((t) => ["ADMIN", "MANAGER", "SALES_EXECUTIVE"].includes(t.role)), {
      title: "Shipment delay",
      message: `Order ${o.orderNumber} for ${o.customer.name} is overdue for dispatch.`,
      category: "SALES",
      severity: "WARNING",
      link: `/sales/orders/${o.id}`,
      entityType: "SalesOrder",
      entityId: o.id,
      ruleKey: `shipment-delay-${o.id}`,
      actions: [
        { type: "VIEW_DETAILS", label: "View order", href: `/sales/orders/${o.id}` },
        { type: "ASSIGN", label: "Assign" },
      ],
    });
  }
}

async function failedLoginAlerts(targets: RuleTarget[]) {
  const failed = await prisma.activityLog.count({
    where: {
      action: ActivityAction.LOGIN_FAILED,
      createdAt: { gte: new Date(Date.now() - 3600000) },
    },
  });

  if (failed >= 3) {
    await notifyMany(targets.filter((t) => t.role === "ADMIN"), {
      title: "Failed login attempts",
      message: `${failed} failed login attempts in the last hour. Review security logs.`,
      category: "SYSTEM",
      severity: "CRITICAL",
      link: "/activity?action=LOGIN_FAILED",
      ruleKey: `failed-logins-${new Date().toISOString().slice(0, 13)}`,
      actions: [{ type: "VIEW_DETAILS", label: "View logs", href: "/activity?action=LOGIN_FAILED" }],
      metadata: { count: failed },
    });
  }
}

async function leaveRequestAlerts(targets: RuleTarget[]) {
  const pending = await prisma.leaveRequest.findMany({
    where: { status: "PENDING" },
    include: { employee: { select: { name: true } } },
    take: 10,
  });

  for (const lr of pending) {
    await notifyMany(targets.filter((t) => ["ADMIN", "MANAGER", "HR_EXECUTIVE"].includes(t.role)), {
      title: "Leave request pending",
      message: `${lr.employee.name} requested leave${lr.reason ? `: ${lr.reason}` : ""} — approval required.`,
      category: "HR",
      severity: "INFO",
      link: "/hr/leave",
      entityType: "LeaveRequest",
      entityId: lr.id,
      ruleKey: `leave-${lr.id}`,
      actions: [
        { type: "APPROVE", label: "Approve", href: "/hr/leave" },
        { type: "REJECT", label: "Reject", href: "/hr/leave" },
        { type: "VIEW_DETAILS", label: "View request", href: "/hr/leave" },
      ],
    });
  }
}

async function expiryAlerts(targets: RuleTarget[]) {
  const threshold = new Date(Date.now() + 30 * 86400000);
  const expiring = await prisma.batch.findMany({
    where: { expiryDate: { lte: threshold, gte: new Date() } },
    include: { product: { select: { name: true } } },
    take: 15,
  });

  for (const b of expiring) {
    const days = Math.ceil((new Date(b.expiryDate!).getTime() - Date.now()) / 86400000);
    await notifyMany(targets.filter((t) => ["ADMIN", "MANAGER"].includes(t.role)), {
      title: "Expiry alert",
      message: `${b.product.name} batch ${b.batchNumber} expires in ${days} day(s). FEFO dispatch required.`,
      category: "PRODUCTION",
      severity: days <= 7 ? "CRITICAL" : "WARNING",
      link: "/inventory",
      entityType: "Batch",
      entityId: b.id,
      ruleKey: `expiry-${b.id}`,
      actions: [
        { type: "VIEW_DETAILS", label: "View batch", href: "/inventory" },
        { type: "RESOLVE", label: "Resolve" },
      ],
      metadata: { daysUntilExpiry: days },
    });
  }
}

async function qcFailureAlerts(targets: RuleTarget[]) {
  const batches = await prisma.productionBatch.findMany({
    where: { status: { in: ["IN_PROGRESS", "COMPLETED"] } },
    select: { id: true, batchCode: true, plannedQty: true, actualQty: true },
    take: 20,
  });

  for (const b of batches) {
    const planned = toNumber(b.plannedQty);
    const actual = toNumber(b.actualQty);
    if (planned <= 0 || actual / planned >= 0.85) continue;

    await notifyMany(targets.filter((t) => ["ADMIN", "MANAGER"].includes(t.role)), {
      title: "QC failure — low batch yield",
      message: `Batch ${b.batchCode} yield ${Math.round((actual / planned) * 100)}% — below QC threshold.`,
      category: "PRODUCTION",
      severity: "CRITICAL",
      link: "/production",
      entityType: "ProductionBatch",
      entityId: b.id,
      ruleKey: `qc-fail-${b.id}`,
      actions: [
        { type: "VIEW_DETAILS", label: "Inspect batch", href: "/production" },
        { type: "RESOLVE", label: "Resolve" },
      ],
    });
  }
}

async function sanitationReminders(targets: RuleTarget[]) {
  const dayKey = new Date().toISOString().slice(0, 10);
  await notifyMany(targets.filter((t) => ["ADMIN", "MANAGER"].includes(t.role)), {
    title: "Sanitation reminder",
    message: "Daily production area sanitation checklist is due before shift start.",
    category: "PRODUCTION",
    severity: "INFO",
    link: "/production",
    ruleKey: `sanitation-${dayKey}`,
    actions: [{ type: "RESOLVE", label: "Mark complete" }],
  });
}

async function rawMaterialShortageAlerts(targets: RuleTarget[]) {
  const products = await prisma.product.findMany({
    where: { minStockQty: { gt: 0 } },
    select: { id: true, name: true, stockQty: true, minStockQty: true, sku: true },
    take: 30,
  });

  for (const p of products) {
    const stock = toNumber(p.stockQty);
    const min = toNumber(p.minStockQty);
    if (stock > min) continue;
    const isRaw = /raw|material|husk|powder/i.test(p.name) || /RM-/i.test(p.sku ?? "");
    if (!isRaw) continue;

    await notifyMany(targets.filter((t) => ["ADMIN", "MANAGER"].includes(t.role)), {
      title: "Raw material shortage",
      message: `${p.name} stock critical (${stock}/${min} units). Production may be impacted.`,
      category: "INVENTORY",
      severity: "CRITICAL",
      link: "/purchases/new",
      entityType: "Product",
      entityId: p.id,
      ruleKey: `raw-shortage-${p.id}`,
      actions: [
        { type: "VIEW_DETAILS", label: "Create PO", href: "/purchases/new" },
        { type: "ASSIGN", label: "Assign buyer" },
      ],
    });
  }
}

async function batchRecallAlerts(targets: RuleTarget[]) {
  const recalled = await prisma.batch.findMany({
    where: {
      expiryDate: { lt: new Date() },
    },
    include: { product: { select: { name: true } } },
    take: 5,
  });

  for (const b of recalled) {
    const qty = toNumber(b.quantity);
    if (qty <= 0) continue;
    await notifyMany(targets.filter((t) => ["ADMIN", "MANAGER"].includes(t.role)), {
      title: "Batch recall required",
      message: `Expired batch ${b.batchNumber} (${b.product.name}) still in stock — initiate recall.`,
      category: "ALERT",
      severity: "CRITICAL",
      link: "/inventory",
      entityType: "Batch",
      entityId: b.id,
      ruleKey: `recall-${b.id}`,
      actions: [
        { type: "VIEW_DETAILS", label: "View batch", href: "/inventory" },
        { type: "RESOLVE", label: "Initiate recall" },
      ],
    });
  }
}

async function escalateCriticalAlerts() {
  const stale = await prisma.notification.findMany({
    where: {
      severity: "CRITICAL",
      status: "OPEN",
      createdAt: { lt: new Date(Date.now() - ESCALATION_MS) },
    },
  });

  const adminIds = await getAdminUserIds();

  for (const n of stale) {
    await prisma.notification.update({
      where: { id: n.id },
      data: { status: "ESCALATED", escalatedAt: new Date() },
    });

    for (const adminId of adminIds) {
      if (adminId === n.userId) continue;
      await upsertNotification({
        userId: adminId,
        title: `[Escalated] ${n.title}`,
        message: `Unresolved critical alert escalated: ${n.message}`,
        category: n.category as NotificationCategory,
        severity: "CRITICAL",
        link: n.link ?? "/notifications",
        entityType: n.entityType ?? undefined,
        entityId: n.entityId ?? undefined,
        ruleKey: `escalation-${n.id}-${adminId}`,
        actions: [
          { type: "VIEW_DETAILS", label: "View alert", href: "/notifications" },
          { type: "ASSIGN", label: "Assign owner" },
        ],
        metadata: { originalNotificationId: n.id },
      });
    }
  }
}

/** Smart rules engine — sync ERP workflow notifications for all active users */
export async function syncWorkflowNotifications(): Promise<number> {
  const users = await getUsersByRoles([
    "ADMIN",
    "MANAGER",
    "SALES_EXECUTIVE",
    "ACCOUNTANT",
    "HR_EXECUTIVE",
  ]);
  const targets: RuleTarget[] = users.map((u) => ({ userId: u.id, role: u.role }));

  await Promise.all([
    lowStockAlerts(targets),
    purchaseApprovalAlerts(targets),
    overduePaymentAlerts(targets),
    productionCompletionAlerts(targets),
    shipmentDelayAlerts(targets),
    failedLoginAlerts(targets),
    leaveRequestAlerts(targets),
    expiryAlerts(targets),
    qcFailureAlerts(targets),
    sanitationReminders(targets),
    rawMaterialShortageAlerts(targets),
    batchRecallAlerts(targets),
  ]);

  await escalateCriticalAlerts();

  const count = await prisma.notification.count({
    where: { status: { in: ["OPEN", "ESCALATED"] }, read: false },
  });

  await logActivity({
    action: ActivityAction.UPDATE,
    entityType: "NotificationRules",
    message: `Workflow notification sync completed (${count} open alerts)`,
    metadata: { openCount: count },
  });

  return count;
}
