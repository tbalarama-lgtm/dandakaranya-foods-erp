import type {
  DockAppointmentStatus,
  PickPackStatus,
  StorageZoneType,
  WarehouseAuditAction,
  WarehouseFacilityKind,
  WarehouseStaffRole,
  WarehouseTaskStatus,
  WarehouseTaskType,
  WarehouseTransferStatus,
} from "@prisma/client";

export const FACILITY_KIND_LABELS: Record<WarehouseFacilityKind, string> = {
  WAREHOUSE: "Warehouse",
  DISTRIBUTION_CENTER: "Distribution center",
  COLD_STORAGE: "Cold storage",
  QUARANTINE_YARD: "Quarantine yard",
  TRANSIT_HUB: "Transit hub",
};

export const FACILITY_KIND_STYLES: Record<WarehouseFacilityKind, string> = {
  WAREHOUSE: "bg-sky-500/12 text-sky-700",
  DISTRIBUTION_CENTER: "bg-violet-500/12 text-violet-700",
  COLD_STORAGE: "bg-cyan-500/12 text-cyan-800",
  QUARANTINE_YARD: "bg-orange-500/12 text-orange-800",
  TRANSIT_HUB: "bg-amber-500/12 text-amber-800",
};

export const ZONE_TYPE_LABELS: Record<StorageZoneType, string> = {
  RAW_MATERIAL: "Raw material",
  FINISHED_GOODS: "Finished goods",
  COLD_STORAGE: "Cold storage",
  QUARANTINE: "Quarantine",
  PACKAGING: "Packaging",
  WIP: "Work in progress",
  HAZMAT: "Hazmat",
  DISPATCH_STAGING: "Dispatch staging",
};

export const TRANSFER_STATUS_LABELS: Record<WarehouseTransferStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  IN_TRANSIT: "In transit",
  PARTIALLY_RECEIVED: "Partially received",
  RECEIVED: "Received",
  CANCELLED: "Cancelled",
};

export const TRANSFER_STATUS_STYLES: Record<WarehouseTransferStatus, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  PENDING_APPROVAL: "bg-amber-500/12 text-amber-800",
  APPROVED: "bg-sky-500/12 text-sky-700",
  IN_TRANSIT: "bg-violet-500/12 text-violet-700",
  PARTIALLY_RECEIVED: "bg-orange-500/12 text-orange-800",
  RECEIVED: "bg-emerald-500/12 text-emerald-700",
  CANCELLED: "bg-red-500/12 text-red-700",
};

export const DISPATCH_STATUS_LABELS: Record<PickPackStatus, string> = {
  PENDING: "Pending",
  APPROVED: "Approved",
  PICKING: "Picking",
  PACKED: "Packed",
  READY_TO_DISPATCH: "Ready to dispatch",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
};

export const DISPATCH_STATUS_STYLES: Record<PickPackStatus, string> = {
  PENDING: "bg-muted text-muted-foreground",
  APPROVED: "bg-sky-500/12 text-sky-700",
  PICKING: "bg-amber-500/12 text-amber-800",
  PACKED: "bg-violet-500/12 text-violet-700",
  READY_TO_DISPATCH: "bg-orange-500/12 text-orange-800",
  DISPATCHED: "bg-emerald-500/12 text-emerald-700",
  DELIVERED: "bg-emerald-600/12 text-emerald-800",
};

export const TASK_TYPE_LABELS: Record<WarehouseTaskType, string> = {
  PUTAWAY: "Putaway",
  PICKING: "Picking",
  CYCLE_COUNT: "Cycle count",
  REPLENISHMENT: "Replenishment",
  QC_HOLD: "QC hold",
  DISPATCH_PREP: "Dispatch prep",
};

export const TASK_STATUS_LABELS: Record<WarehouseTaskStatus, string> = {
  OPEN: "Open",
  ASSIGNED: "Assigned",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const STAFF_ROLE_LABELS: Record<WarehouseStaffRole, string> = {
  MANAGER: "Manager",
  SUPERVISOR: "Supervisor",
  PICKER: "Picker",
  PACKER: "Packer",
  RECEIVER: "Receiver",
  PUTAWAY: "Putaway",
  QC_INSPECTOR: "QC inspector",
  FORKLIFT_OPERATOR: "Forklift operator",
};

export const DOCK_STATUS_LABELS: Record<DockAppointmentStatus, string> = {
  SCHEDULED: "Scheduled",
  CHECKED_IN: "Checked in",
  LOADING: "Loading",
  COMPLETED: "Completed",
  NO_SHOW: "No show",
  CANCELLED: "Cancelled",
};

export const AUDIT_ACTION_LABELS: Record<WarehouseAuditAction, string> = {
  CREATED: "Created",
  UPDATED: "Updated",
  TRANSFER_REQUEST: "Transfer request",
  TRANSFER_APPROVED: "Transfer approved",
  TRANSFER_SHIPPED: "Transfer shipped",
  TRANSFER_RECEIVED: "Transfer received",
  DISPATCH: "Dispatch",
  CAPACITY_ALERT: "Capacity alert",
  ENVIRONMENT_ALERT: "Environment alert",
  CYCLE_COUNT: "Cycle count",
  TASK_COMPLETED: "Task completed",
  STAFF_ASSIGNED: "Staff assigned",
};

export type WarehouseHubKpis = {
  branchCount: number;
  warehouseCount: number;
  distributionCenterCount: number;
  totalInventoryValue: number;
  activeSkus: number;
  openTransfers: number;
  pendingDispatch: number;
  avgUtilizationPct: number;
  overflowAlerts: number;
  quarantineQty: number;
  openTasks: number;
  dockToday: number;
  dispatchEfficiencyPct: number;
  turnoverDays: number;
};

export type BranchRow = {
  id: string;
  code: string;
  name: string;
  region: string | null;
  city: string | null;
  state: string | null;
  warehouseCount: number;
  dcCount: number;
  inventoryValue: number;
  activeSkus: number;
  latitude: number | null;
  longitude: number | null;
  isActive: boolean;
};

export type WarehouseGovernanceRow = {
  id: string;
  code: string;
  name: string;
  facilityKind: WarehouseFacilityKind;
  branchName: string | null;
  dcName: string | null;
  city: string | null;
  inventoryValue: number;
  activeSkus: number;
  batchCount: number;
  binCount: number;
  utilizationPct: number;
  palletUtilizationPct: number;
  quarantineQty: number;
  openTransfers: number;
  pendingDispatch: number;
  isColdStorage: boolean;
  overflow: boolean;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
};

export type DistributionCenterRow = {
  id: string;
  code: string;
  name: string;
  region: string | null;
  branchName: string | null;
  warehouseCount: number;
  palletCapacity: number;
  utilizationPct: number;
  latitude: number | null;
  longitude: number | null;
  active: boolean;
};

export type TransferRow = {
  id: string;
  transferNumber: string;
  fromWarehouse: string;
  toWarehouse: string;
  status: WarehouseTransferStatus;
  itemCount: number;
  totalQty: number;
  transporterName: string | null;
  lrNumber: string | null;
  vehicleNumber: string | null;
  requestedAt: string;
  shippedAt: string | null;
  receivedAt: string | null;
};

export type DispatchRow = {
  id: string;
  dispatchNumber: string;
  warehouseName: string | null;
  status: PickPackStatus;
  lineCount: number;
  totalQty: number;
  pickedPct: number;
  transporterName: string | null;
  lrNumber: string | null;
  dockBay: string | null;
  createdAt: string;
  dispatchedAt: string | null;
};

export type WarehouseTaskRow = {
  id: string;
  warehouseName: string;
  taskType: WarehouseTaskType;
  status: WarehouseTaskStatus;
  title: string;
  binCode: string | null;
  assigneeName: string | null;
  priority: number;
  dueAt: string | null;
};

export type WarehouseMapPoint = {
  id: string;
  name: string;
  kind: "branch" | "warehouse" | "dc";
  latitude: number;
  longitude: number;
  inventoryValue: number;
  utilizationPct: number;
};

export type WarehouseHubBundle = {
  kpis: WarehouseHubKpis;
  branches: BranchRow[];
  warehouses: WarehouseGovernanceRow[];
  distributionCenters: DistributionCenterRow[];
  transfers: TransferRow[];
  dispatches: DispatchRow[];
  tasks: WarehouseTaskRow[];
  mapPoints: WarehouseMapPoint[];
  utilizationTrend: { label: string; utilization: number; value: number }[];
  agingBuckets: { label: string; qty: number; value: number }[];
  recentAudit: { id: string; title: string; action: WarehouseAuditAction; createdAt: string }[];
};

export type WarehouseDetail = {
  id: string;
  code: string;
  name: string;
  facilityKind: WarehouseFacilityKind;
  branchName: string | null;
  dcName: string | null;
  address: string | null;
  city: string | null;
  inventoryValue: number;
  activeSkus: number;
  utilizationPct: number;
  palletUtilizationPct: number;
  quarantineQty: number;
  fefoAlerts: number;
  isColdStorage: boolean;
  tempRange: string | null;
  humidityRange: string | null;
  latitude: number | null;
  longitude: number | null;
  zones: { id: string; code: string; name: string; zoneType: StorageZoneType; utilizationPct: number; binCount: number }[];
  hierarchy: { zone: string; rack: string; shelf: string; bin: string; usedKg: number; capacityKg: number }[];
  batches: { id: string; batchNumber: string; productName: string; qty: number; status: string; expiryDate: string | null; binCode: string | null }[];
  staff: { id: string; name: string; role: WarehouseStaffRole; email: string }[];
  tasks: WarehouseTaskRow[];
  transfers: TransferRow[];
  dispatches: DispatchRow[];
  environmental: { recordedAt: string; temperatureC: number | null; humidityPct: number | null; inRange: boolean }[];
  forecast: { label: string; demand: number; replenishment: number; aiOptimized: number }[];
  traces: { id: string; eventType: string; productName: string; quantity: number; reference: string | null; tracedAt: string }[];
};

export type BranchDetail = {
  id: string;
  code: string;
  name: string;
  region: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  email: string | null;
  latitude: number | null;
  longitude: number | null;
  warehouseCount: number;
  dcCount: number;
  inventoryValue: number;
  activeSkus: number;
  warehouses: WarehouseGovernanceRow[];
  distributionCenters: DistributionCenterRow[];
  regionalPlans: { id: string; region: string; planYear: number; targetVolume: number; actualVolume: number; attainmentPct: number }[];
};
