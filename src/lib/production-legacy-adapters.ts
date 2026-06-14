import type { ProductionAlertType, ProductionMachineStatus, ProductionStatus } from "@prisma/client";
import type { ProductionHubBundle } from "@/lib/production-types";
import type {
  Machine,
  MachineStatus,
  ProductionNotification,
  ProductionStatus as LegacyProductionStatus,
  QcInspection,
  RawMaterialRow,
  WorkOrder,
} from "@/lib/production/types";

function mapLegacyProductionStatus(status: ProductionStatus): LegacyProductionStatus {
  switch (status) {
    case "PLANNED":
      return "PLANNED";
    case "RELEASED":
      return "PENDING";
    case "IN_PROGRESS":
    case "QC":
      return "IN_PROGRESS";
    case "COMPLETED":
      return "COMPLETED";
    case "REJECTED":
      return "DELAYED";
    case "CANCELLED":
      return "CANCELLED";
    default:
      return "PENDING";
  }
}

function mapMachineStatus(status: ProductionMachineStatus): MachineStatus {
  if (status === "IDLE") return "ACTIVE";
  return status as MachineStatus;
}

function fallbackDate(iso: string | null, daysAgo: number): string {
  if (iso) return iso;
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString();
}

const ALERT_TYPE_MAP: Record<ProductionAlertType, ProductionNotification["type"]> = {
  MATERIAL_SHORTAGE: "MATERIAL",
  DOWNTIME: "MACHINE",
  DELAYED_BATCH: "DELAY",
  QC_FAILURE: "QUALITY",
  YIELD_VARIANCE: "QUALITY",
  BOTTLENECK: "MACHINE",
};

function mapAlertPriority(severity: string): ProductionNotification["priority"] {
  if (severity === "critical" || severity === "HIGH") return "high";
  if (severity === "warning" || severity === "MEDIUM") return "medium";
  return "low";
}

export function mapMachinesToLegacy(bundle: ProductionHubBundle): Machine[] {
  return bundle.machines.map((m) => ({
    id: m.id,
    name: m.name,
    line: m.line ?? m.branchName ?? "Production line",
    status: mapMachineStatus(m.status),
    utilization: m.utilizationPct,
    runtimeHours: Math.max(1, Math.round(m.throughputKg / 12)),
    downtimeHours: m.downtimeHours,
    lastMaintenance: fallbackDate(m.lastMaintenance, 45),
    nextMaintenance: fallbackDate(m.nextMaintenance, -14),
  }));
}

export function mapWorkOrdersToLegacy(bundle: ProductionHubBundle): WorkOrder[] {
  return bundle.workOrders.map((wo) => ({
    id: wo.id,
    orderNo: wo.orderNumber,
    productName: wo.productName,
    batchNumber: wo.batchCode ?? "—",
    quantity: wo.quantity,
    priority: wo.priority,
    status: mapLegacyProductionStatus(wo.status),
    assignedTeam: wo.assignedTeam ?? "Unassigned",
    materialAllocated: wo.materialAllocated,
    progress: wo.progress,
    notes: wo.notes ?? undefined,
  }));
}

export function mapMaterialsToLegacy(bundle: ProductionHubBundle): RawMaterialRow[] {
  return bundle.materialCatalog.map((m) => ({
    id: m.id,
    name: m.name,
    sku: m.sku,
    stockQty: m.stockQty,
    unit: m.unit,
    consumedToday: m.consumedToday,
    reorderLevel: m.reorderLevel,
    costPerUnit: m.costPerUnit,
    warehouse: m.warehouseName ?? "Main WH",
  }));
}

export function mapQcToLegacy(bundle: ProductionHubBundle): QcInspection[] {
  return bundle.qcInspections.map((q) => ({
    id: q.id,
    batchNumber: q.batchCode,
    productName: q.productName,
    inspector: q.inspector ?? "QC team",
    inspectedAt: q.auditedAt,
    result: q.passed ? "PASS" : "FAIL",
    defectCount: q.passed ? 0 : 1,
    score: q.passed ? 96 : 62,
    notes: q.notes ? `${q.standard}: ${q.notes}` : q.standard,
  }));
}

export function mapNotificationsToLegacy(bundle: ProductionHubBundle): ProductionNotification[] {
  return bundle.alerts.map((a) => ({
    id: a.id,
    type: ALERT_TYPE_MAP[a.alertType] ?? "DELAY",
    title: a.title,
    message: a.message ?? (a.batchCode ? `Batch ${a.batchCode}` : ""),
    createdAt: a.createdAt,
    read: a.resolved,
    priority: mapAlertPriority(a.severity),
  }));
}
