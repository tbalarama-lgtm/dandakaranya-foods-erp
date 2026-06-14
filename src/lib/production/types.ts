export type ProductionStatus = "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DELAYED" | "CANCELLED" | "PLANNED";
export type MachineStatus = "ACTIVE" | "MAINTENANCE" | "OFFLINE" | "BREAKDOWN";
export type QcResult = "PASS" | "FAIL" | "HOLD";
export type WorkOrderPriority = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

export type ProductionDashboardMetrics = {
  productionToday: number;
  targetToday: number;
  achievedToday: number;
  activeLines: number;
  machineUtilization: number;
  efficiency: number;
  downtimeHours: number;
  rejectedUnits: number;
  rawMaterialConsumption: number;
  activeBatches: number;
  workerAttendance: number;
  oeeScore: number;
  productionTrend: { shift: string; planned: number; actual: number }[];
  departmentOutput: { name: string; output: number }[];
  shiftAnalytics: { shift: string; efficiency: number }[];
};

export type ProductionPlan = {
  id: string;
  productName: string;
  batchNumber: string;
  quantityPlanned: number;
  quantityProduced: number;
  startTime: string;
  endTime: string;
  assignedTeam: string;
  machine: string;
  status: ProductionStatus;
  shift: string;
};

export type WorkOrder = {
  id: string;
  orderNo: string;
  productName: string;
  batchNumber: string;
  quantity: number;
  priority: WorkOrderPriority;
  status: ProductionStatus;
  assignedTeam: string;
  materialAllocated: boolean;
  progress: number;
  notes?: string;
};

export type RawMaterialRow = {
  id: string;
  name: string;
  sku: string;
  stockQty: number;
  unit: string;
  consumedToday: number;
  reorderLevel: number;
  costPerUnit: number;
  warehouse: string;
};

export type Machine = {
  id: string;
  name: string;
  line: string;
  status: MachineStatus;
  utilization: number;
  runtimeHours: number;
  downtimeHours: number;
  lastMaintenance: string;
  nextMaintenance: string;
};

export type QcInspection = {
  id: string;
  batchNumber: string;
  productName: string;
  inspector: string;
  inspectedAt: string;
  result: QcResult;
  defectCount: number;
  score: number;
  notes?: string;
};

export type BatchLot = {
  id: string;
  batchNumber: string;
  productName: string;
  lotCode: string;
  mfgDate: string;
  expiryDate: string;
  quantity: number;
  status: ProductionStatus;
  traceId: string;
};

export type ProductionNotification = {
  id: string;
  type: "MACHINE" | "MATERIAL" | "DELAY" | "QUALITY" | "MAINTENANCE" | "SHIFT";
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
  priority: "high" | "medium" | "low";
};
