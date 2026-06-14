"use client";

import type { CommandCenterMetrics } from "@/lib/command-center-types";
import type { UserRole } from "@prisma/client";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardHero } from "@/components/dashboard/dashboard-hero";
import { CommandCenterKpis, CommandCenterCharts } from "@/components/dashboard/command-center-kpi";
import {
  CriticalAlertsBar,
  NotificationsApprovalCenter,
  CommandCenterWidgets,
} from "@/components/dashboard/command-center-widgets";
import {
  InventoryPanel,
  PipelinePanel,
  TopProductsPanel,
} from "@/components/dashboard/dashboard-panels";
import { QuickActionsFab } from "@/components/dashboard/quick-actions-fab";
import { can } from "@/lib/rbac";

export function CommandCenter({
  metrics,
  userName,
  role,
}: {
  metrics: CommandCenterMetrics;
  userName: string;
  role: UserRole;
}) {
  return (
    <DashboardShell>
      <DashboardHero userName={userName} />
      <CriticalAlertsBar metrics={metrics} />
      <CommandCenterKpis metrics={metrics} />
      <CommandCenterCharts metrics={metrics} />

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {can(role, "inventory.view") && (
            <InventoryPanel
              totalSkus={metrics.inventoryStatus.totalSkus}
              inStock={metrics.inventoryStatus.inStock}
              lowStockCount={metrics.inventoryStatus.lowStockCount}
              lowStock={metrics.lowStock}
            />
          )}
          {can(role, "leads.view") && (
            <PipelinePanel pipeline={metrics.leadPipeline} conversionRatio={metrics.leadConversionRatio} />
          )}
        </div>
        <NotificationsApprovalCenter metrics={metrics} />
      </div>

      <CommandCenterWidgets metrics={metrics} role={role} />

      {can(role, "sales.view") && <TopProductsPanel products={metrics.topProducts} />}

      <QuickActionsFab />
    </DashboardShell>
  );
}
