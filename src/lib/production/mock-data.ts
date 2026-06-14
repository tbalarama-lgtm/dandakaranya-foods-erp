import type {
  BatchLot,
  Machine,
  ProductionDashboardMetrics,
  ProductionNotification,
  ProductionPlan,
  QcInspection,
  RawMaterialRow,
  WorkOrder,
} from "./types";

export const PRODUCTION_PLANTS = ["Sukma Plant", "Raipur Unit", "All plants"];

export const MOCK_PRODUCTION_PLANS: ProductionPlan[] = [
  {
    id: "pp-1",
    productName: "Tamarind Husk Powder",
    batchNumber: "TB-2026-0519-A",
    quantityPlanned: 500,
    quantityProduced: 420,
    startTime: "2026-05-19T06:00",
    endTime: "2026-05-19T14:00",
    assignedTeam: "Line A — Morning",
    machine: "Pulverizer-01",
    status: "IN_PROGRESS",
    shift: "Morning",
  },
  {
    id: "pp-2",
    productName: "Organic Turmeric Powder",
    batchNumber: "TB-2026-0519-B",
    quantityPlanned: 300,
    quantityProduced: 0,
    startTime: "2026-05-19T14:00",
    endTime: "2026-05-19T22:00",
    assignedTeam: "Line B — Evening",
    machine: "Dryer-02",
    status: "PLANNED",
    shift: "Evening",
  },
  {
    id: "pp-3",
    productName: "Mango Pickle (Bulk)",
    batchNumber: "TB-2026-0518-C",
    quantityPlanned: 200,
    quantityProduced: 198,
    startTime: "2026-05-18T06:00",
    endTime: "2026-05-18T18:00",
    assignedTeam: "Line C",
    machine: "Mixer-03",
    status: "COMPLETED",
    shift: "Morning",
  },
];

export const MOCK_WORK_ORDERS: WorkOrder[] = [
  {
    id: "wo-1",
    orderNo: "WO-2026-0142",
    productName: "Tamarind Husk Powder",
    batchNumber: "TB-2026-0519-A",
    quantity: 500,
    priority: "HIGH",
    status: "IN_PROGRESS",
    assignedTeam: "Line A",
    materialAllocated: true,
    progress: 84,
    notes: "FSSAI batch documentation pending",
  },
  {
    id: "wo-2",
    orderNo: "WO-2026-0143",
    productName: "Turmeric Powder",
    batchNumber: "TB-2026-0519-B",
    quantity: 300,
    priority: "MEDIUM",
    status: "PENDING",
    assignedTeam: "Line B",
    materialAllocated: true,
    progress: 0,
  },
  {
    id: "wo-3",
    orderNo: "WO-2026-0138",
    productName: "Spice Mix Export",
    batchNumber: "TB-2026-0517-D",
    quantity: 150,
    priority: "URGENT",
    status: "DELAYED",
    assignedTeam: "Line A",
    materialAllocated: false,
    progress: 35,
    notes: "Raw tamarind shortage",
  },
];

export const MOCK_RAW_MATERIALS: RawMaterialRow[] = [
  { id: "rm-1", name: "Raw Tamarind", sku: "RM-TAM-01", stockQty: 2400, unit: "kg", consumedToday: 380, reorderLevel: 500, costPerUnit: 42, warehouse: "WH-A" },
  { id: "rm-2", name: "Turmeric Rhizome", sku: "RM-TUR-02", stockQty: 890, unit: "kg", consumedToday: 120, reorderLevel: 200, costPerUnit: 95, warehouse: "WH-A" },
  { id: "rm-3", name: "Laminated Pouches", sku: "PK-LAM-500", stockQty: 12000, unit: "pcs", consumedToday: 4500, reorderLevel: 3000, costPerUnit: 2.5, warehouse: "WH-B" },
  { id: "rm-4", name: "Iodized Salt", sku: "RM-SLT-01", stockQty: 180, unit: "kg", consumedToday: 45, reorderLevel: 100, costPerUnit: 18, warehouse: "WH-A" },
];

export const MOCK_MACHINES: Machine[] = [
  { id: "m-1", name: "Pulverizer-01", line: "Line A", status: "ACTIVE", utilization: 87, runtimeHours: 6.2, downtimeHours: 0.5, lastMaintenance: "2026-05-10", nextMaintenance: "2026-06-10" },
  { id: "m-2", name: "Dryer-02", line: "Line B", status: "ACTIVE", utilization: 72, runtimeHours: 5.8, downtimeHours: 1.2, lastMaintenance: "2026-05-05", nextMaintenance: "2026-06-05" },
  { id: "m-3", name: "Mixer-03", line: "Line C", status: "MAINTENANCE", utilization: 0, runtimeHours: 0, downtimeHours: 8, lastMaintenance: "2026-05-19", nextMaintenance: "2026-05-20" },
  { id: "m-4", name: "Packaging-04", line: "Line D", status: "BREAKDOWN", utilization: 12, runtimeHours: 1, downtimeHours: 7, lastMaintenance: "2026-04-28", nextMaintenance: "2026-05-22" },
  { id: "m-5", name: "Sorter-05", line: "Line A", status: "OFFLINE", utilization: 0, runtimeHours: 0, downtimeHours: 8, lastMaintenance: "2026-05-01", nextMaintenance: "2026-06-01" },
];

export const MOCK_QC: QcInspection[] = [
  { id: "qc-1", batchNumber: "TB-2026-0518-C", productName: "Mango Pickle", inspector: "Meena Kumari", inspectedAt: "2026-05-18T19:00", result: "PASS", defectCount: 2, score: 96 },
  { id: "qc-2", batchNumber: "TB-2026-0517-D", productName: "Spice Mix", inspector: "Arjun Patel", inspectedAt: "2026-05-17T16:30", result: "HOLD", defectCount: 8, score: 82, notes: "Moisture retest required" },
  { id: "qc-3", batchNumber: "TB-2026-0516-A", productName: "Tamarind Powder", inspector: "Meena Kumari", inspectedAt: "2026-05-16T15:00", result: "FAIL", defectCount: 24, score: 68, notes: "Metal detector alert" },
];

export const MOCK_BATCHES: BatchLot[] = [
  { id: "bl-1", batchNumber: "TB-2026-0519-A", productName: "Tamarind Husk Powder", lotCode: "LOT-TAM-0519-01", mfgDate: "2026-05-19", expiryDate: "2027-05-19", quantity: 420, status: "IN_PROGRESS", traceId: "TRC-88421" },
  { id: "bl-2", batchNumber: "TB-2026-0518-C", productName: "Mango Pickle", lotCode: "LOT-MPK-0518-02", mfgDate: "2026-05-18", expiryDate: "2027-11-18", quantity: 198, status: "COMPLETED", traceId: "TRC-88409" },
];

export const MOCK_PRODUCTION_NOTIFICATIONS: ProductionNotification[] = [
  { id: "pn-1", type: "MACHINE", title: "Packaging-04 breakdown", message: "Line D packaging unit stopped — technician dispatched.", createdAt: new Date().toISOString(), read: false, priority: "high" },
  { id: "pn-2", type: "MATERIAL", title: "Low salt stock", message: "Iodized salt below reorder level (180 kg).", createdAt: new Date().toISOString(), read: false, priority: "high" },
  { id: "pn-3", type: "DELAY", title: "WO-2026-0138 delayed", message: "Spice mix export batch at 35% — material shortage.", createdAt: new Date().toISOString(), read: false, priority: "medium" },
  { id: "pn-4", type: "QUALITY", title: "QC hold — Spice Mix", message: "Batch TB-2026-0517-D awaiting moisture retest.", createdAt: new Date().toISOString(), read: true, priority: "medium" },
  { id: "pn-5", type: "MAINTENANCE", title: "Mixer-03 scheduled", message: "Preventive service due tomorrow 08:00.", createdAt: new Date().toISOString(), read: true, priority: "low" },
];

export const MOCK_MAINTENANCE = [
  { id: "mt-1", equipment: "Mixer-03", type: "Preventive", scheduled: "2026-05-20", technician: "Vikram Singh", status: "SCHEDULED" },
  { id: "mt-2", equipment: "Packaging-04", type: "Breakdown", scheduled: "2026-05-19", technician: "External AMC", status: "IN_PROGRESS" },
];

export const MOCK_STAFF_SHIFTS = [
  { shift: "Morning", operators: 24, attendance: 22, productivity: 91 },
  { shift: "Evening", operators: 18, attendance: 17, productivity: 88 },
  { shift: "Night", operators: 8, attendance: 8, productivity: 85 },
];

export const MOCK_FINISHED_INVENTORY = [
  { id: "fg-1", product: "Tamarind Husk Powder", sku: "FG-TAM-500", stock: 1200, unit: "kg", warehouse: "FG-WH-A", dispatchReady: true, lastMovement: "2026-05-19" },
  { id: "fg-2", product: "Organic Turmeric Powder", sku: "FG-TUR-250", stock: 640, unit: "kg", warehouse: "FG-WH-A", dispatchReady: true, lastMovement: "2026-05-18" },
  { id: "fg-3", product: "Mango Pickle (Bulk)", sku: "FG-MPK-20L", stock: 198, unit: "kg", warehouse: "FG-WH-B", dispatchReady: false, lastMovement: "2026-05-18" },
  { id: "pk-1", product: "Laminated Pouches 500g", sku: "PK-LAM-500", stock: 7500, unit: "pcs", warehouse: "PKG-WH", dispatchReady: true, lastMovement: "2026-05-19" },
];

export const MOCK_CONSUMPTION_TREND = [
  { day: "Mon", tamarind: 320, turmeric: 80, packaging: 3200 },
  { day: "Tue", tamarind: 380, turmeric: 120, packaging: 4100 },
  { day: "Wed", tamarind: 290, turmeric: 95, packaging: 3800 },
  { day: "Thu", tamarind: 410, turmeric: 110, packaging: 4500 },
  { day: "Fri", tamarind: 380, turmeric: 120, packaging: 4200 },
];

export const MOCK_DEFECT_TREND = [
  { week: "W1", defects: 12, rejections: 8 },
  { week: "W2", defects: 18, rejections: 14 },
  { week: "W3", defects: 9, rejections: 6 },
  { week: "W4", defects: 24, rejections: 18 },
];

export const REPORT_TYPES = [
  "Daily Production",
  "Shift Report",
  "Machine Utilization",
  "Downtime",
  "Quality",
  "Material Consumption",
  "Rejection",
] as const;

export function getProductionDashboardMetrics(): ProductionDashboardMetrics {
  return {
    productionToday: 618,
    targetToday: 1000,
    achievedToday: 618,
    activeLines: 3,
    machineUtilization: 78,
    efficiency: 92,
    downtimeHours: 2.5,
    rejectedUnits: 24,
    rawMaterialConsumption: 545,
    activeBatches: 4,
    workerAttendance: 47,
    oeeScore: 81,
    productionTrend: [
      { shift: "06-10", planned: 250, actual: 240 },
      { shift: "10-14", planned: 350, actual: 320 },
      { shift: "14-18", planned: 200, actual: 58 },
      { shift: "18-22", planned: 200, actual: 0 },
    ],
    departmentOutput: [
      { name: "Pulverizing", output: 420 },
      { name: "Drying", output: 0 },
      { name: "Mixing", output: 198 },
      { name: "Packaging", output: 0 },
    ],
    shiftAnalytics: [
      { shift: "Morning", efficiency: 94 },
      { shift: "Evening", efficiency: 88 },
      { shift: "Night", efficiency: 85 },
    ],
  };
}
