import type {
  ProductionAlertType,
  ProductionAuditAction,
  ProductionMachineStatus,
  ProductionMaintenanceStatus,
  ProductionStage,
  ProductionStatus,
  ProductionUtilityType,
  WorkOrderPriority,
} from "@prisma/client";

export const PRODUCTION_STATUS_LABELS: Record<ProductionStatus, string> = {
  PLANNED: "Planned",
  RELEASED: "Released",
  IN_PROGRESS: "In production",
  QC: "QC hold",
  COMPLETED: "Completed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
};

export const PRODUCTION_STATUS_STYLES: Record<ProductionStatus, string> = {
  PLANNED: "bg-muted text-muted-foreground",
  RELEASED: "bg-sky-500/12 text-sky-700",
  IN_PROGRESS: "bg-amber-500/12 text-amber-800",
  QC: "bg-violet-500/12 text-violet-700",
  COMPLETED: "bg-emerald-500/12 text-emerald-700",
  REJECTED: "bg-red-500/12 text-red-700",
  CANCELLED: "bg-red-500/8 text-red-600",
};

export const STAGE_LABELS: Record<ProductionStage, string> = {
  MIXING: "Mixing",
  HEATING: "Heating",
  DRYING: "Drying",
  GRINDING: "Grinding",
  PACKING: "Packing",
};

export const STAGE_ORDER: ProductionStage[] = ["MIXING", "HEATING", "DRYING", "GRINDING", "PACKING"];

export const MACHINE_STATUS_LABELS: Record<ProductionMachineStatus, string> = {
  ACTIVE: "Active",
  IDLE: "Idle",
  MAINTENANCE: "Maintenance",
  BREAKDOWN: "Breakdown",
  OFFLINE: "Offline",
};

export const PRIORITY_LABELS: Record<WorkOrderPriority, string> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const ALERT_TYPE_LABELS: Record<ProductionAlertType, string> = {
  MATERIAL_SHORTAGE: "Material shortage",
  DOWNTIME: "Downtime",
  DELAYED_BATCH: "Delayed batch",
  QC_FAILURE: "QC failure",
  YIELD_VARIANCE: "Yield variance",
  BOTTLENECK: "Bottleneck",
};

export const UTILITY_LABELS: Record<ProductionUtilityType, string> = {
  GAS: "Gas",
  ELECTRICITY: "Electricity",
  STEAM: "Steam",
  WATER: "Water",
};

export const MAINTENANCE_STATUS_LABELS: Record<ProductionMaintenanceStatus, string> = {
  SCHEDULED: "Scheduled",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  OVERDUE: "Overdue",
  CANCELLED: "Cancelled",
};

export const AUDIT_ACTION_LABELS: Record<ProductionAuditAction, string> = {
  ORDER_CREATED: "Order created",
  ORDER_RELEASED: "Order released",
  STAGE_STARTED: "Stage started",
  STAGE_COMPLETED: "Stage completed",
  QC_SUBMITTED: "QC submitted",
  QC_PASSED: "QC passed",
  QC_FAILED: "QC failed",
  BATCH_COMPLETED: "Batch completed",
  SCHEDULE_UPDATED: "Schedule updated",
  MATERIAL_SHORTAGE: "Material shortage",
  MAINTENANCE: "Maintenance",
  COMPLIANCE: "Compliance",
};

export type ProductionHubKpis = {
  activeBatches: number;
  plannedOrders: number;
  inProduction: number;
  qcHold: number;
  oeeAvg: number;
  machineUtilization: number;
  downtimeHours: number;
  yieldAvgPct: number;
  materialShortages: number;
  openAlerts: number;
  delayedBatches: number;
  productionToday: number;
  targetToday: number;
};

export type BatchGovernanceRow = {
  id: string;
  batchCode: string;
  productName: string;
  recipeName: string;
  branchName: string | null;
  machineName: string | null;
  shiftName: string | null;
  status: ProductionStatus;
  currentStage: ProductionStage | null;
  plannedQty: number;
  actualQty: number | null;
  expectedYieldPct: number;
  actualYieldPct: number | null;
  wastageQty: number;
  totalCost: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  delayed: boolean;
};

export type GanttSlot = {
  id: string;
  batchId: string;
  batchCode: string;
  productName: string;
  machineId: string | null;
  machineName: string | null;
  shiftId: string | null;
  shiftName: string | null;
  status: ProductionStatus;
  scheduledStart: string;
  scheduledEnd: string;
  ganttRow: number;
  sequenceOrder: number;
};

export type MachineRow = {
  id: string;
  code: string;
  name: string;
  line: string | null;
  branchName: string | null;
  status: ProductionMachineStatus;
  utilizationPct: number;
  throughputKg: number;
  downtimeHours: number;
  oee: number;
  lastMaintenance: string | null;
  nextMaintenance: string | null;
};

export type WorkOrderGovernanceRow = {
  id: string;
  orderNumber: string;
  productName: string;
  batchCode: string | null;
  quantity: number;
  priority: WorkOrderPriority;
  status: ProductionStatus;
  assignedTeam: string | null;
  materialAllocated: boolean;
  progress: number;
  notes: string | null;
};

export type QcGovernanceRow = {
  id: string;
  batchCode: string;
  productName: string;
  inspector: string | null;
  auditedAt: string;
  passed: boolean;
  standard: string;
  notes: string | null;
};

export type MaterialCatalogRow = {
  id: string;
  sku: string;
  name: string;
  stockQty: number;
  unit: string;
  costPerUnit: number;
  reorderLevel: number;
  warehouseName: string | null;
  consumedToday: number;
};

export type MrpLine = {
  productId: string;
  sku: string;
  productName: string;
  requiredQty: number;
  availableQty: number;
  shortageQty: number;
  unit: string;
  batchesAffected: number;
};

export type ProductionAlertRow = {
  id: string;
  alertType: ProductionAlertType;
  severity: string;
  title: string;
  message: string | null;
  batchCode: string | null;
  createdAt: string;
  resolved: boolean;
};

export type ProductionHubBundle = {
  kpis: ProductionHubKpis;
  batches: BatchGovernanceRow[];
  ganttSlots: GanttSlot[];
  machines: MachineRow[];
  mrpLines: MrpLine[];
  alerts: ProductionAlertRow[];
  workOrders: WorkOrderGovernanceRow[];
  qcInspections: QcGovernanceRow[];
  materialCatalog: MaterialCatalogRow[];
  oeeTrend: { label: string; oee: number; availability: number; performance: number; quality: number }[];
  stageThroughput: { stage: string; output: number }[];
  shiftOutput: { shift: string; planned: number; actual: number }[];
  recentAudit: { id: string; title: string; action: ProductionAuditAction; createdAt: string }[];
  branches: { id: string; name: string; code: string }[];
};

export type ProductionBatchDetail = {
  id: string;
  batchCode: string;
  status: ProductionStatus;
  currentStage: ProductionStage | null;
  productName: string;
  recipeName: string;
  branchName: string | null;
  machineName: string | null;
  plannedQty: number;
  actualQty: number | null;
  expectedYieldPct: number;
  actualYieldPct: number | null;
  wastageQty: number;
  recoveryQty: number;
  materialCost: number;
  laborCost: number;
  machineCost: number;
  utilityCost: number;
  totalCost: number;
  scheduledStart: string | null;
  scheduledEnd: string | null;
  stages: { stage: ProductionStage; startedAt: string | null; completedAt: string | null; operatorName: string | null }[];
  materials: { productName: string; requiredQty: number; allocatedQty: number; shortageQty: number; unit: string }[];
  utilities: { type: ProductionUtilityType; quantity: number; unit: string; cost: number | null }[];
  compliance: { standard: string; passed: boolean; auditedAt: string }[];
  operators: { name: string; role: string; overtimeHours: number }[];
  traces: { eventType: string; reference: string; tracedAt: string }[];
};
