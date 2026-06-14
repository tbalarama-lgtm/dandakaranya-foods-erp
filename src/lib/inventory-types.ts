import type {
  AdjustmentReasonCode,
  BatchInventoryStatus,
  BatchQcStatus,
  InventoryAdjustmentStatus,
  InventoryAuditAction,
  InventoryItemClass,
  InventoryReservationPurpose,
  InventoryValuationMethod,
  PickPackStatus,
  StockMovementType,
  StockRotationPolicy,
  WarehouseTransferStatus,
} from "@prisma/client";

export const INVENTORY_CLASS_LABELS: Record<InventoryItemClass, string> = {
  RAW_MATERIAL: "Raw material",
  WIP: "Work in progress",
  FINISHED_GOODS: "Finished goods",
  PACKAGING: "Packaging",
  QUARANTINE: "Quarantine",
  REJECTED: "Rejected",
};

export const INVENTORY_CLASS_STYLES: Record<InventoryItemClass, string> = {
  RAW_MATERIAL: "bg-amber-500/12 text-amber-800",
  WIP: "bg-sky-500/12 text-sky-700",
  FINISHED_GOODS: "bg-emerald-500/12 text-emerald-700",
  PACKAGING: "bg-violet-500/12 text-violet-700",
  QUARANTINE: "bg-orange-500/12 text-orange-800",
  REJECTED: "bg-red-500/12 text-red-700",
};

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  IN: "Stock in",
  OUT: "Stock out",
  ADJUSTMENT: "Adjustment",
  TRANSFER: "Transfer",
  GRN: "GRN receipt",
  PRODUCTION_IN: "Production output",
  PRODUCTION_OUT: "Production consumption",
  SALES: "Sales dispatch",
  RETURN: "Return",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
};

export const VALUATION_LABELS: Record<InventoryValuationMethod, string> = {
  FIFO: "FIFO",
  WEIGHTED_AVERAGE: "Weighted average",
  LANDED_COST: "Landed cost",
};

export const BATCH_STATUS_LABELS: Record<BatchInventoryStatus, string> = {
  AVAILABLE: "Available",
  QUARANTINE: "Quarantine",
  REJECTED: "Rejected",
  EXPIRED: "Expired",
  RESERVED: "Reserved",
};

export const QC_STATUS_LABELS: Record<BatchQcStatus, string> = {
  PENDING: "Pending",
  PASSED: "Passed",
  FAILED: "Failed",
  HOLD: "On hold",
};

export const REASON_CODE_LABELS: Record<AdjustmentReasonCode, string> = {
  DAMAGE: "Damage",
  SHRINKAGE: "Shrinkage",
  COUNT_VARIANCE: "Count variance",
  QC_REJECTION: "QC rejection",
  EXPIRY_WRITE_OFF: "Expiry write-off",
  PRODUCTION_YIELD: "Production yield",
  OTHER: "Other",
};

export const UNIT_CONVERSIONS: Record<string, Record<string, number>> = {
  kg: { kg: 1, mt: 0.001, g: 1000 },
  mt: { kg: 1000, mt: 1 },
  jar: { jar: 1, pouch: 0.5 },
  pouch: { pouch: 1, jar: 2 },
  drum: { drum: 1, kg: 200 },
};

export type InventoryHubKpis = {
  totalValue: number;
  skuCount: number;
  lowStock: number;
  deadStock: number;
  nearExpiry: number;
  quarantineQty: number;
  rejectedQty: number;
  openTransfers: number;
  pendingPickPack: number;
  reservedQty: number;
  avgYieldPct: number;
  reorderAlerts: number;
};

export type InventoryRow = {
  id: string;
  sku: string;
  name: string;
  inventoryClass: InventoryItemClass;
  categoryName: string | null;
  warehouseName: string | null;
  unit: string;
  stockQty: number;
  reservedQty: number;
  availableQty: number;
  minStockQty: number;
  safetyStockQty: number;
  reorderPoint: number;
  costPrice: number;
  stockValue: number;
  valuationMethod: InventoryValuationMethod;
  rotationPolicy: StockRotationPolicy;
  batchCount: number;
  nearExpiryBatches: number;
  reorderAlert: boolean;
  lowStock: boolean;
  deadStock: boolean;
  barcode: string | null;
};

export type BatchRow = {
  id: string;
  batchNumber: string;
  quantity: number;
  reservedQty: number;
  supplierBatch: string | null;
  productionBatch: string | null;
  dispatchBatchRef: string | null;
  mfgDate: string | null;
  expiryDate: string | null;
  inventoryStatus: BatchInventoryStatus;
  qcStatus: BatchQcStatus;
  binCode: string | null;
  zone: string | null;
  landedCost: number | null;
  yieldPct: number | null;
  daysToExpiry: number | null;
  barcodeData: string | null;
};

export type MovementRow = {
  id: string;
  type: StockMovementType;
  quantity: number;
  unit: string;
  reference: string | null;
  referenceType: string | null;
  reasonCode: AdjustmentReasonCode | null;
  notes: string | null;
  createdAt: string;
  warehouseName: string | null;
};

export type ReservationRow = {
  id: string;
  purpose: InventoryReservationPurpose;
  quantity: number;
  unit: string;
  referenceId: string | null;
  expiresAt: string | null;
  createdAt: string;
};

export type TransferRow = {
  id: string;
  transferNumber: string;
  fromWarehouse: string;
  toWarehouse: string;
  status: WarehouseTransferStatus;
  itemCount: number;
  createdAt: string;
};

export type PickPackRow = {
  id: string;
  dispatchNumber: string;
  status: PickPackStatus;
  warehouseName: string | null;
  lineCount: number;
  createdAt: string;
};

export type InventoryAuditEntry = {
  id: string;
  action: InventoryAuditAction;
  title: string;
  detail: string | null;
  actorName: string | null;
  createdAt: string;
};

export type DemandForecastPoint = {
  month: string;
  demand: number;
  actual: number | null;
  aiForecast: number | null;
};

export type InventoryDetail = {
  product: InventoryRow;
  batches: BatchRow[];
  movements: MovementRow[];
  reservations: ReservationRow[];
  auditLog: InventoryAuditEntry[];
  demandForecast: DemandForecastPoint[];
};

export type InventoryHubBundle = {
  rows: InventoryRow[];
  kpis: InventoryHubKpis;
  transfers: TransferRow[];
  pickPack: PickPackRow[];
  recentMovements: MovementRow[];
  classBreakdown: { class: InventoryItemClass; label: string; qty: number; value: number }[];
  nearExpiry: BatchRow[];
  recentAudit: InventoryAuditEntry[];
};

export type BinRow = {
  id: string;
  code: string;
  zone: string | null;
  rack: string | null;
  aisle: string | null;
  warehouseName: string;
  capacityKg: number | null;
  utilizationPct: number;
};
