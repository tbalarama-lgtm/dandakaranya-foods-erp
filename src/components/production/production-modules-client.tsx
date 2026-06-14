"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Calendar,
  GripVertical,
  QrCode,
  Search,
  Wifi,
  Brain,
  ScanLine,
  Radio,
  Factory,
  FileText,
  Bell,
  AlertTriangle,
} from "lucide-react";
import type {
  BatchLot,
  Machine,
  ProductionNotification,
  ProductionPlan,
  QcInspection,
  RawMaterialRow,
  WorkOrder,
} from "@/lib/production/types";
import {
  MOCK_CONSUMPTION_TREND,
  MOCK_DEFECT_TREND,
  MOCK_FINISHED_INVENTORY,
  MOCK_MAINTENANCE,
  MOCK_STAFF_SHIFTS,
  PRODUCTION_PLANTS,
  REPORT_TYPES,
} from "@/lib/production/mock-data";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { ProductionStatusBadge } from "@/components/production/status-badge";
import { ProductionExportButtons } from "@/components/production/production-export-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn, formatInr } from "@/lib/utils";
import { toast } from "sonner";

function FiltersRow({
  search,
  onSearch,
  plant,
  onPlant,
}: {
  search: string;
  onSearch: (v: string) => void;
  plant: string;
  onPlant: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="relative min-w-[200px] flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input className="pl-9" placeholder="Search…" value={search} onChange={(e) => onSearch(e.target.value)} />
      </div>
      <select
        className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
        value={plant}
        onChange={(e) => onPlant(e.target.value)}
      >
        {PRODUCTION_PLANTS.map((p) => (
          <option key={p} value={p}>{p}</option>
        ))}
      </select>
    </div>
  );
}

function IotPlaceholder() {
  return (
    <GlassCard glow="blue">
      <GlassCardBody className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
        <span className="flex items-center gap-2"><Wifi className="h-4 w-4 text-primary" /> IoT machine feed</span>
        <span className="flex items-center gap-2"><ScanLine className="h-4 w-4" /> Barcode / RFID</span>
        <span className="flex items-center gap-2"><Brain className="h-4 w-4" /> AI forecasting</span>
        <span className="flex items-center gap-2"><Radio className="h-4 w-4" /> Smart factory</span>
        <Badge variant="muted">API-ready · Multi-plant</Badge>
      </GlassCardBody>
    </GlassCard>
  );
}

export function ProductionPlanningClient({ plans }: { plans: ProductionPlan[] }) {
  const [search, setSearch] = useState("");
  const [plant, setPlant] = useState("All plants");
  const filtered = useMemo(
    () => plans.filter((p) => `${p.productName} ${p.batchNumber}`.toLowerCase().includes(search.toLowerCase())),
    [plans, search],
  );

  return (
    <div className="space-y-6">
      <FiltersRow search={search} onSearch={setSearch} plant={plant} onPlant={setPlant} />
      <div className="flex flex-wrap justify-end gap-2">
        <Button size="sm" onClick={() => toast.info("Batch plan wizard — connect API")}>New plan</Button>
        <ProductionExportButtons filename="production-plans" />
      </div>
      <GlassCard glow="violet">
        <GlassCardHeader className="flex flex-row items-center justify-between">
          <div>
            <h3 className="font-semibold">Production calendar & Gantt</h3>
            <p className="text-xs text-muted-foreground">Drag-and-drop scheduling · weekly / monthly view</p>
          </div>
          <Calendar className="h-5 w-5 text-muted-foreground" />
        </GlassCardHeader>
        <GlassCardBody>
          <div className="flex h-32 items-center justify-center rounded-xl border border-dashed bg-muted/20 text-sm text-muted-foreground">
            <GripVertical className="mr-2 h-4 w-4" /> Timeline / Gantt chart placeholder
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {["Daily", "Weekly", "Capacity"].map((v) => (
              <div key={v} className="rounded-lg border p-3 text-center text-sm">
                <p className="font-medium">{v}</p>
                <p className="text-xs text-muted-foreground">Shift allocation</p>
              </div>
            ))}
          </div>
        </GlassCardBody>
      </GlassCard>
      <GlassCard>
        <GlassCardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Batch</th>
                <th className="px-4 py-2">Planned</th>
                <th className="px-4 py-2">Produced</th>
                <th className="px-4 py-2">Schedule</th>
                <th className="px-4 py-2">Team / Machine</th>
                <th className="px-4 py-2">Shift</th>
                <th className="px-4 py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const pct = p.quantityPlanned ? Math.round((p.quantityProduced / p.quantityPlanned) * 100) : 0;
                return (
                  <tr key={p.id} className="border-b border-border/40">
                    <td className="px-4 py-3 font-medium">{p.productName}</td>
                    <td className="px-4 py-3 font-mono text-xs">{p.batchNumber}</td>
                    <td className="px-4 py-3">{p.quantityPlanned} kg</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span>{p.quantityProduced} kg</span>
                        <div className="h-1.5 w-16 rounded-full bg-muted">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {p.startTime.slice(11, 16)} – {p.endTime.slice(11, 16)}
                    </td>
                    <td className="px-4 py-3 text-xs">{p.assignedTeam}<br />{p.machine}</td>
                    <td className="px-4 py-3">{p.shift}</td>
                    <td className="px-4 py-3"><ProductionStatusBadge status={p.status} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </GlassCardBody>
      </GlassCard>
      <IotPlaceholder />
    </div>
  );
}

export function ProductionWorkOrdersClient({ orders }: { orders: WorkOrder[] }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ALL");
  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const matchSearch = `${o.orderNo} ${o.productName}`.toLowerCase().includes(search.toLowerCase());
      const matchStatus = status === "ALL" || o.status === status;
      return matchSearch && matchStatus;
    });
  }, [orders, search, status]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input className="pl-9" placeholder="Search work orders…" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="h-10 rounded-xl border px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="ALL">All statuses</option>
          {["PENDING", "IN_PROGRESS", "COMPLETED", "DELAYED", "CANCELLED"].map((s) => (
            <option key={s} value={s}>{s.replace("_", " ")}</option>
          ))}
        </select>
        <Button size="sm" onClick={() => toast.info("Create work order — API placeholder")}>Create WO</Button>
        <ProductionExportButtons filename="work-orders" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {filtered.map((o) => (
          <GlassCard key={o.id}>
            <GlassCardBody className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{o.orderNo}</p>
                  <p className="text-sm text-muted-foreground">{o.productName}</p>
                </div>
                <QrCode className="h-8 w-8 text-muted-foreground/50" />
              </div>
              <p className="font-mono text-xs text-muted-foreground">{o.batchNumber} · {o.quantity} kg</p>
              <div className="flex flex-wrap gap-2">
                <ProductionStatusBadge status={o.status} />
                <ProductionStatusBadge status={o.priority} />
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary" style={{ width: `${o.progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">
                {o.assignedTeam} · Materials {o.materialAllocated ? "allocated" : "pending"}
              </p>
              {o.notes && <p className="text-xs text-amber-700 dark:text-amber-400">{o.notes}</p>}
            </GlassCardBody>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

export function ProductionMaterialsClient({ materials }: { materials: RawMaterialRow[] }) {
  const lowStock = materials.filter((m) => m.stockQty <= m.reorderLevel);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <ProductionExportButtons filename="raw-materials" />
      </div>
      {lowStock.length > 0 && (
        <GlassCard glow="amber">
          <GlassCardHeader className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-600" />
            <h3 className="font-semibold">Low stock alerts ({lowStock.length})</h3>
          </GlassCardHeader>
          <GlassCardBody className="flex flex-wrap gap-2">
            {lowStock.map((m) => (
              <Badge key={m.id} variant="muted" className="bg-amber-500/10">
                {m.name}: {m.stockQty} {m.unit}
              </Badge>
            ))}
          </GlassCardBody>
        </GlassCard>
      )}
      <div className="grid gap-6 lg:grid-cols-2">
        <GlassCard glow="blue">
          <GlassCardHeader><h3 className="font-semibold">Consumption trend</h3></GlassCardHeader>
          <GlassCardBody className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={MOCK_CONSUMPTION_TREND}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" />
                <YAxis />
                <Tooltip />
                <Line dataKey="tamarind" stroke="hsl(158 45% 42%)" name="Tamarind (kg)" />
                <Line dataKey="turmeric" stroke="hsl(38 55% 52%)" name="Turmeric (kg)" />
              </LineChart>
            </ResponsiveContainer>
          </GlassCardBody>
        </GlassCard>
        <GlassCard>
          <GlassCardHeader><h3 className="font-semibold">Warehouse & FIFO/LIFO</h3></GlassCardHeader>
          <GlassCardBody className="space-y-2 text-sm text-muted-foreground">
            <p>Warehouse integration · batch-wise RM tracking</p>
            <div className="flex gap-2">
              <Badge>FIFO</Badge>
              <Badge variant="muted">LIFO</Badge>
              <Button size="sm" variant="outline" onClick={() => toast.info("Material request submitted")}>Request material</Button>
            </div>
          </GlassCardBody>
        </GlassCard>
      </div>
      <GlassCard>
        <GlassCardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Material</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Stock</th>
                <th className="px-4 py-2">Consumed today</th>
                <th className="px-4 py-2">Cost/unit</th>
                <th className="px-4 py-2">WH</th>
              </tr>
            </thead>
            <tbody>
              {materials.map((m) => (
                <tr key={m.id} className={cn("border-b", m.stockQty <= m.reorderLevel && "bg-amber-500/5")}>
                  <td className="px-4 py-2 font-medium">{m.name}</td>
                  <td className="px-4 py-2 font-mono text-xs">{m.sku}</td>
                  <td className="px-4 py-2">{m.stockQty} {m.unit}</td>
                  <td className="px-4 py-2">{m.consumedToday} {m.unit}</td>
                  <td className="px-4 py-2">{formatInr(m.costPerUnit)}</td>
                  <td className="px-4 py-2">{m.warehouse}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}

export function ProductionMachinesClient({ machines }: { machines: Machine[] }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Badge className="animate-pulse bg-emerald-500/20 text-emerald-700">Live status</Badge>
        <ProductionExportButtons filename="machines" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {machines.map((m) => (
          <GlassCard key={m.id} glow={m.status === "BREAKDOWN" ? "amber" : m.status === "ACTIVE" ? "emerald" : undefined}>
            <GlassCardBody className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{m.name}</p>
                <ProductionStatusBadge status={m.status} />
              </div>
              <p className="text-xs text-muted-foreground">{m.line}</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><p className="text-muted-foreground">Utilization</p><p className="font-semibold">{m.utilization}%</p></div>
                <div><p className="text-muted-foreground">Runtime</p><p className="font-semibold">{m.runtimeHours}h</p></div>
                <div><p className="text-muted-foreground">Downtime</p><p className="font-semibold">{m.downtimeHours}h</p></div>
                <div><p className="text-muted-foreground">Next PM</p><p className="text-xs font-medium">{m.nextMaintenance}</p></div>
              </div>
              <div className="h-2 rounded-full bg-muted">
                <div className={cn("h-full rounded-full", m.utilization > 70 ? "bg-emerald-500" : "bg-amber-500")} style={{ width: `${m.utilization}%` }} />
              </div>
              <p className="text-[10px] text-muted-foreground">Predictive maintenance AI placeholder</p>
            </GlassCardBody>
          </GlassCard>
        ))}
      </div>
      <IotPlaceholder />
    </div>
  );
}

export function ProductionQualityClient({ inspections }: { inspections: QcInspection[] }) {
  const passRate = Math.round((inspections.filter((i) => i.result === "PASS").length / inspections.length) * 100) || 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <GlassCard glow="emerald"><GlassCardBody><p className="text-xs text-muted-foreground">Pass rate</p><p className="text-2xl font-semibold">{passRate}%</p></GlassCardBody></GlassCard>
        <GlassCard><GlassCardBody><p className="text-xs text-muted-foreground">Inspections</p><p className="text-2xl font-semibold">{inspections.length}</p></GlassCardBody></GlassCard>
        <GlassCard glow="amber"><GlassCardBody><p className="text-xs text-muted-foreground">Open holds</p><p className="text-2xl font-semibold">{inspections.filter((i) => i.result === "HOLD").length}</p></GlassCardBody></GlassCard>
      </div>
      <GlassCard>
        <GlassCardHeader><h3 className="font-semibold">Defect & rejection trends</h3></GlassCardHeader>
        <GlassCardBody className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={MOCK_DEFECT_TREND}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="defects" fill="hsl(38 55% 52%)" name="Defects" radius={[4, 4, 0, 0]} />
              <Bar dataKey="rejections" fill="hsl(0 70% 55%)" name="Rejections" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </GlassCardBody>
      </GlassCard>
      <GlassCard>
        <GlassCardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Batch</th>
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">Inspector</th>
                <th className="px-4 py-2">Score</th>
                <th className="px-4 py-2">Defects</th>
                <th className="px-4 py-2">Result</th>
              </tr>
            </thead>
            <tbody>
              {inspections.map((i) => (
                <tr key={i.id} className="border-b">
                  <td className="px-4 py-2 font-mono text-xs">{i.batchNumber}</td>
                  <td className="px-4 py-2">{i.productName}</td>
                  <td className="px-4 py-2">{i.inspector}</td>
                  <td className="px-4 py-2">{i.score}%</td>
                  <td className="px-4 py-2">{i.defectCount}</td>
                  <td className="px-4 py-2"><ProductionStatusBadge status={i.result} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCardBody>
      </GlassCard>
      <Button variant="outline" onClick={() => toast.info("QC inspection form — API placeholder")}>New inspection</Button>
    </div>
  );
}

export function ProductionBatchesClient({ batches }: { batches: BatchLot[] }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end gap-2">
        <Button size="sm" onClick={() => toast.info("Batch creation wizard")}>Create batch</Button>
        <ProductionExportButtons filename="batches" />
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {batches.map((b) => (
          <GlassCard key={b.id}>
            <GlassCardBody className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="font-semibold">{b.productName}</p>
                <QrCode className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="font-mono text-sm">{b.batchNumber}</p>
              <p className="text-xs text-muted-foreground">Lot {b.lotCode} · Trace {b.traceId}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <span>MFG {b.mfgDate}</span>
                <span>EXP {b.expiryDate}</span>
                <span>{b.quantity} kg</span>
              </div>
              <ProductionStatusBadge status={b.status} />
            </GlassCardBody>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}

export function ProductionStaffClient() {
  return (
    <div className="space-y-6">
      <ProductionExportButtons filename="production-staff" />
      <div className="grid gap-4 md:grid-cols-3">
        {MOCK_STAFF_SHIFTS.map((s) => (
          <GlassCard key={s.shift}>
            <GlassCardBody>
              <p className="font-semibold">{s.shift} shift</p>
              <p className="mt-2 text-2xl font-semibold text-primary">{s.productivity}%</p>
              <p className="text-xs text-muted-foreground">Productivity</p>
              <p className="mt-2 text-sm">Attendance {s.attendance}/{s.operators}</p>
            </GlassCardBody>
          </GlassCard>
        ))}
      </div>
      <GlassCard>
        <GlassCardHeader><h3 className="font-semibold">Shift calendar</h3></GlassCardHeader>
        <GlassCardBody className="flex h-40 items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          Operator assignment & HR attendance integration placeholder
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}

export function ProductionMaintenanceClient() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => toast.info("Schedule maintenance")}>Schedule service</Button>
      </div>
      <GlassCard>
        <GlassCardHeader><h3 className="font-semibold">Maintenance calendar</h3></GlassCardHeader>
        <GlassCardBody className="space-y-3">
          {MOCK_MAINTENANCE.map((m) => (
            <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
              <div>
                <p className="font-medium">{m.equipment}</p>
                <p className="text-sm text-muted-foreground">{m.type} · {m.scheduled} · {m.technician}</p>
              </div>
              <ProductionStatusBadge status={m.status === "IN_PROGRESS" ? "IN_PROGRESS" : "PLANNED"} />
            </div>
          ))}
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}

export function ProductionInventoryClient() {
  return (
    <div className="space-y-6">
      <ProductionExportButtons filename="production-inventory" />
      <GlassCard glow="emerald">
        <GlassCardHeader><h3 className="font-semibold">Production → warehouse flow</h3></GlassCardHeader>
        <GlassCardBody className="text-sm text-muted-foreground">
          Real-time stock updates · finished goods · packaging · dispatch readiness
        </GlassCardBody>
      </GlassCard>
      <GlassCard>
        <GlassCardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">Product</th>
                <th className="px-4 py-2">SKU</th>
                <th className="px-4 py-2">Stock</th>
                <th className="px-4 py-2">Warehouse</th>
                <th className="px-4 py-2">Dispatch</th>
              </tr>
            </thead>
            <tbody>
              {MOCK_FINISHED_INVENTORY.map((row) => (
                <tr key={row.id} className="border-b">
                  <td className="px-4 py-2 font-medium">{row.product}</td>
                  <td className="px-4 py-2 font-mono text-xs">{row.sku}</td>
                  <td className="px-4 py-2">{row.stock} {row.unit}</td>
                  <td className="px-4 py-2">{row.warehouse}</td>
                  <td className="px-4 py-2">
                    {row.dispatchReady ? (
                      <Badge className="bg-emerald-500/15 text-emerald-700">Ready</Badge>
                    ) : (
                      <Badge variant="muted">QC hold</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}

export function ProductionReportsClient() {
  const [plant, setPlant] = useState("All plants");
  const [period, setPeriod] = useState("today");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-3">
        <select className="h-10 rounded-xl border px-3 text-sm" value={plant} onChange={(e) => setPlant(e.target.value)}>
          {PRODUCTION_PLANTS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <select className="h-10 rounded-xl border px-3 text-sm" value={period} onChange={(e) => setPeriod(e.target.value)}>
          <option value="today">Today</option>
          <option value="week">This week</option>
          <option value="month">This month</option>
        </select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map((name) => (
          <GlassCard key={name}>
            <GlassCardBody className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <p className="font-semibold">{name}</p>
              </div>
              <p className="text-xs text-muted-foreground">{plant} · {period}</p>
              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => toast.success(`${name} PDF`)}>PDF</Button>
                <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.success(`${name} Excel`)}>Excel</Button>
              </div>
            </GlassCardBody>
          </GlassCard>
        ))}
      </div>
      <ProductionExportButtons filename="production-reports" />
    </div>
  );
}

export function ProductionNotificationsClient({ items }: { items: ProductionNotification[] }) {
  const [list, setList] = useState(items);
  const unread = list.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <GlassCard glow="amber">
        <GlassCardBody className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            <span className="font-medium">{unread} unread alerts</span>
          </div>
          <Button size="sm" variant="outline" onClick={() => setList((prev) => prev.map((n) => ({ ...n, read: true })))}>
            Mark all read
          </Button>
        </GlassCardBody>
      </GlassCard>
      <div className="space-y-2">
        {list.map((n) => (
          <GlassCard key={n.id} className={cn(!n.read && "ring-1 ring-primary/30")}>
            <GlassCardBody className="flex gap-3">
              <Factory className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{n.title}</p>
                  <Badge variant="muted">{n.type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{n.message}</p>
              </div>
              {!n.read && (
                <Button size="sm" variant="ghost" onClick={() => setList((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))}>
                  Dismiss
                </Button>
              )}
            </GlassCardBody>
          </GlassCard>
        ))}
      </div>
    </div>
  );
}
