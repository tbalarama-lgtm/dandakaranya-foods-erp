"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Bell,
  CheckCircle2,
  ClipboardCheck,
  Factory,
  Landmark,
  MapPin,
  Package,
  ShieldCheck,
  Truck,
  Users,
  Warehouse,
} from "lucide-react";
import type { CommandCenterMetrics } from "@/lib/command-center-types";
import type { UserRole } from "@prisma/client";
import { can } from "@/lib/rbac";
import { formatInr, formatDate, cn } from "@/lib/utils";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export function CriticalAlertsBar({ metrics }: { metrics: CommandCenterMetrics }) {
  if (metrics.databaseOffline) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200"
      >
        <p className="flex items-start gap-2 font-medium">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={ICON_STROKE} />
          Database offline — KPIs are empty until Supabase is reachable. Check your network, resume the
          project in the Supabase dashboard, then run{" "}
          <code className="rounded bg-black/10 px-1 py-0.5 text-xs">npm run db:test</code>.
        </p>
      </motion.div>
    );
  }

  const alerts = [
    metrics.inventoryStatus.lowStockCount > 0 && {
      label: `${metrics.inventoryStatus.lowStockCount} low-stock items`,
      href: "/inventory",
      tone: "amber" as const,
    },
    metrics.foodManufacturing.expiringWithin30Days > 0 && {
      label: `${metrics.foodManufacturing.expiringWithin30Days} batches expiring soon`,
      href: "/production/batches",
      tone: "red" as const,
    },
    metrics.pendingApprovals.total > 0 && {
      label: `${metrics.pendingApprovals.total} pending approvals`,
      href: "/purchases/approvals",
      tone: "gold" as const,
    },
  ].filter(Boolean) as { label: string; href: string; tone: "amber" | "red" | "gold" }[];

  if (alerts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap gap-2"
    >
      {alerts.map((a) => (
        <Link
          key={a.label}
          href={a.href}
          className={cn(
            "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-medium transition hover:-translate-y-0.5",
            a.tone === "amber" && "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
            a.tone === "red" && "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
            a.tone === "gold" && "border-[#B68D40]/30 bg-[#B68D40]/10 text-[#967235] dark:text-[#C9A55A]",
          )}
        >
          <AlertTriangle className="h-3.5 w-3.5" strokeWidth={ICON_STROKE} />
          {a.label}
        </Link>
      ))}
    </motion.div>
  );
}

export function NotificationsApprovalCenter({ metrics }: { metrics: CommandCenterMetrics }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="erp-kpi-card flex h-full flex-col p-5"
    >
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Bell className="h-4 w-4 text-[#B68D40]" strokeWidth={ICON_STROKE} />
          Notifications & approvals
        </h3>
        <Badge variant="danger">{metrics.notifications.length}</Badge>
      </div>

      <div className="mt-4 space-y-2">
        {metrics.notifications.length === 0 ? (
          <p className="text-sm text-muted-foreground">No unread notifications</p>
        ) : (
          metrics.notifications.slice(0, 5).map((n) => (
            <Link
              key={n.id}
              href={n.link ?? "/notifications"}
              className="block rounded-xl border border-border/50 bg-muted/20 px-3 py-2.5 text-sm transition hover:border-[#B68D40]/30 hover:bg-muted/40"
            >
              <p className="font-medium">{n.title}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{n.message}</p>
            </Link>
          ))
        )}
      </div>

      <div className="mt-4 rounded-xl border border-[#B68D40]/20 bg-[#B68D40]/5 p-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-[#B68D40]">Approval center</p>
        <div className="mt-2 flex gap-4 text-sm">
          <Link href="/purchases/approvals" className="hover:underline">
            GRN <strong>{metrics.pendingApprovals.purchases}</strong>
          </Link>
          <Link href="/documents/approvals" className="hover:underline">
            Documents <strong>{metrics.pendingApprovals.documents}</strong>
          </Link>
        </div>
      </div>

      <Button asChild variant="secondary" size="sm" className="mt-auto pt-4">
        <Link href="/notifications">View all</Link>
      </Button>
    </motion.div>
  );
}

export function CommandCenterWidgets({
  metrics,
  role,
}: {
  metrics: CommandCenterMetrics;
  role: UserRole;
}) {
  return (
    <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
      {can(role, "finance.view") && <FinanceWidget metrics={metrics} />}
      {can(role, "hr.view") && <HrWidget metrics={metrics} />}
      {can(role, "purchases.view") && <ProcurementWidget metrics={metrics} />}
      {can(role, "inventory.view") && <WarehouseWidget metrics={metrics} />}
      {can(role, "sales.view") && <DeliveryWidget metrics={metrics} />}
      {can(role, "production.view") && <ProductionPlanningWidget metrics={metrics} />}
      {(can(role, "production.view") || can(role, "inventory.view")) && (
        <FoodManufacturingWidget metrics={metrics} />
      )}
      {can(role, "activity.view") && <AuditWidget metrics={metrics} />}
    </div>
  );
}

function FinanceWidget({ metrics }: { metrics: CommandCenterMetrics }) {
  const f = metrics.financeSummary;
  return (
    <WidgetShell title="Finance summary" icon={Landmark} href="/finance/ledger">
      <dl className="space-y-2 text-sm">
        <WidgetRow label="Revenue YTD" value={formatInr(f.revenueYtd)} />
        <WidgetRow label="Expenses (month)" value={formatInr(f.expensesMonth)} />
        <WidgetRow label="Receivables" value={formatInr(f.pendingReceivables)} />
        <WidgetRow label="Payables" value={formatInr(f.pendingPayables)} />
        <WidgetRow label="Net (month)" value={formatInr(f.netMonth)} highlight />
      </dl>
    </WidgetShell>
  );
}

function HrWidget({ metrics }: { metrics: CommandCenterMetrics }) {
  const h = metrics.hrPayroll;
  return (
    <WidgetShell title="HR & payroll" icon={Users} href="/hr/employees">
      <dl className="space-y-2 text-sm">
        <WidgetRow label="Active employees" value={String(h.employeesActive)} />
        <WidgetRow label="Pending leave" value={String(h.pendingLeaves)} />
        <WidgetRow label="Attendance today" value={String(h.attendanceToday)} />
      </dl>
    </WidgetShell>
  );
}

function ProcurementWidget({ metrics }: { metrics: CommandCenterMetrics }) {
  const p = metrics.procurement;
  return (
    <WidgetShell title="Procurement tracking" icon={Truck} href="/purchases">
      <dl className="space-y-2 text-sm">
        <WidgetRow label="Registered vendors" value={String(p.vendorCount)} />
        <WidgetRow label="Month spend" value={formatInr(p.monthPurchases)} />
        <WidgetRow label="Open GRN" value={String(p.openGrn)} />
        <WidgetRow label="Pending approval" value={String(p.pendingApprovals)} />
      </dl>
    </WidgetShell>
  );
}

function WarehouseWidget({ metrics }: { metrics: CommandCenterMetrics }) {
  return (
    <WidgetShell title="Warehouse overview" icon={Warehouse} href="/branches">
      {metrics.warehouses.length === 0 ? (
        <p className="text-sm text-muted-foreground">No warehouses configured</p>
      ) : (
        <ul className="space-y-2">
          {metrics.warehouses.map((w) => (
            <li key={w.id} className="flex items-center gap-2 rounded-lg bg-muted/30 px-3 py-2 text-sm">
              <MapPin className="h-3.5 w-3.5 text-[#B68D40]" strokeWidth={ICON_STROKE} />
              <span className="font-medium">{w.name}</span>
              <span className="ml-auto text-xs text-muted-foreground">{w.code}</span>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

function DeliveryWidget({ metrics }: { metrics: CommandCenterMetrics }) {
  return (
    <WidgetShell title="Live delivery tracking" icon={Truck} href="/sales">
      {metrics.liveDeliveries.length === 0 ? (
        <p className="text-sm text-muted-foreground">No active deliveries</p>
      ) : (
        <ul className="space-y-2">
          {metrics.liveDeliveries.map((d) => (
            <li key={d.id} className="rounded-lg border border-border/50 px-3 py-2 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">{d.invoiceNumber}</span>
                <Badge variant="muted" className="text-[10px]">
                  {d.status.replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-muted-foreground">{d.customer}</p>
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

function ProductionPlanningWidget({ metrics }: { metrics: CommandCenterMetrics }) {
  const p = metrics.productionOverview;
  return (
    <WidgetShell title="Production planning" icon={Factory} href="/production/planning">
      <dl className="space-y-2 text-sm">
        <WidgetRow label="Active batches" value={String(p.activeBatches)} />
        <WidgetRow label="Planned" value={String(p.planned)} />
        <WidgetRow label="Completed" value={String(p.completed)} />
        <WidgetRow label="Today output" value={`${p.todayOutput} units`} highlight />
      </dl>
    </WidgetShell>
  );
}

function FoodManufacturingWidget({ metrics }: { metrics: CommandCenterMetrics }) {
  const f = metrics.foodManufacturing;
  return (
    <WidgetShell title="Food manufacturing & compliance" icon={ShieldCheck} href="/production/quality" className="md:col-span-2 xl:col-span-3">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <ComplianceChip ok={f.gstRegistered} label="GST / FSSAI registered" />
        <ComplianceChip ok={f.traceabilityScore >= 50} label={`Traceability ${f.traceabilityScore}%`} />
        <ComplianceChip ok={f.qualityChecksPending === 0} label="Quality control" warn={f.qualityChecksPending > 0} />
        <ComplianceChip ok={f.expiringWithin30Days === 0} label="Expiry monitoring" warn={f.expiringWithin30Days > 0} />
      </div>
      {f.expiringItems.length > 0 && (
        <ul className="mt-4 space-y-1.5 text-sm">
          {f.expiringItems.slice(0, 4).map((b) => (
            <li key={b.id} className="flex items-center gap-2 text-muted-foreground">
              <Package className="h-3.5 w-3.5 text-amber-500" strokeWidth={ICON_STROKE} />
              {b.batchNumber} · {b.productName} · exp {formatDate(b.expiryDate)}
            </li>
          ))}
        </ul>
      )}
    </WidgetShell>
  );
}

function AuditWidget({ metrics }: { metrics: CommandCenterMetrics }) {
  return (
    <WidgetShell title="Audit log monitor" icon={ClipboardCheck} href="/activity" className="md:col-span-2 xl:col-span-3">
      <ActivityFeed items={metrics.recentActivity.slice(0, 8)} />
    </WidgetShell>
  );
}

function WidgetShell({
  title,
  icon: Icon,
  href,
  children,
  className,
}: {
  title: string;
  icon: React.ElementType;
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.2 }}
      className={cn("erp-kpi-card p-5", className)}
    >
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4 text-[#B68D40]" strokeWidth={ICON_STROKE} />
          {title}
        </h3>
        <Link href={href} className="text-xs font-medium text-[#B68D40] hover:underline">
          Open
        </Link>
      </div>
      {children}
    </motion.div>
  );
}

function WidgetRow({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between border-b border-border/30 pb-2 last:border-0">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn("font-semibold", highlight && "text-[#B68D40]")}>{value}</dd>
    </div>
  );
}

function ComplianceChip({ ok, label, warn }: { ok: boolean; label: string; warn?: boolean }) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-medium",
        ok && !warn && "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
        (!ok || warn) && "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
      )}
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" strokeWidth={ICON_STROKE} />
      {label}
    </div>
  );
}
