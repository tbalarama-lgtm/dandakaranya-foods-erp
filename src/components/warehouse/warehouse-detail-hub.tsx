"use client";

import Link from "next/link";
import { useTransition } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  BarChart3,
  Layers,
  MapPin,
  Package,
  Thermometer,
  Truck,
  Users,
} from "lucide-react";
import { completeWarehouseTask, runWarehouseForecast } from "@/actions/warehouse-workflow";
import type { WarehouseDetail } from "@/lib/warehouse-types";
import {
  DISPATCH_STATUS_LABELS,
  DISPATCH_STATUS_STYLES,
  FACILITY_KIND_LABELS,
  FACILITY_KIND_STYLES,
  STAFF_ROLE_LABELS,
  TASK_STATUS_LABELS,
  TASK_TYPE_LABELS,
  TRANSFER_STATUS_LABELS,
  TRANSFER_STATUS_STYLES,
  ZONE_TYPE_LABELS,
} from "@/lib/warehouse-types";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { toast } from "sonner";
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

export function WarehouseDetailHub({ detail, canEdit }: { detail: WarehouseDetail; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();

  function handleForecast() {
    startTransition(async () => {
      const res = await runWarehouseForecast(detail.id);
      if (res.ok) toast.success("AI replenishment forecast updated");
      else toast.error(res.error);
    });
  }

  function handleCompleteTask(taskId: string) {
    startTransition(async () => {
      const res = await completeWarehouseTask(taskId);
      if (res.ok) toast.success("Task completed");
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/warehouses" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Warehouses
        </Link>
        <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", FACILITY_KIND_STYLES[detail.facilityKind])}>
          {FACILITY_KIND_LABELS[detail.facilityKind]}
        </span>
        {detail.isColdStorage && <span className="rounded-md bg-cyan-500/12 px-2 py-0.5 text-[10px] font-semibold text-cyan-800">Cold storage</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MiniKpi label="Inventory value" value={formatInr(detail.inventoryValue)} />
        <MiniKpi label="Active SKUs" value={String(detail.activeSkus)} />
        <MiniKpi label="Utilization" value={`${detail.utilizationPct}%`} sub={`Pallet ${detail.palletUtilizationPct}%`} />
        <MiniKpi label="FEFO alerts" value={String(detail.fefoAlerts)} sub={`Quarantine ${detail.quarantineQty}`} />
      </div>

      {(detail.tempRange || detail.latitude) && (
        <div className="flex flex-wrap gap-4 rounded-xl border border-border/60 p-4 text-sm">
          {detail.tempRange && (
            <span className="flex items-center gap-1"><Thermometer className="h-4 w-4" /> {detail.tempRange}</span>
          )}
          {detail.humidityRange && <span>Humidity {detail.humidityRange}</span>}
          {detail.latitude != null && detail.longitude != null && (
            <a href={`https://www.google.com/maps?q=${detail.latitude},${detail.longitude}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-[#B68D40] hover:underline">
              <MapPin className="h-4 w-4" /> Map location
            </a>
          )}
          {canEdit && (
            <Button size="sm" variant="secondary" disabled={pending} onClick={handleForecast}>Run AI forecast</Button>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Storage zones" icon={Layers}>
          {detail.zones.length === 0 ? (
            <p className="text-xs text-muted-foreground">No structured zones — bins use legacy zone labels.</p>
          ) : (
            detail.zones.map((z) => (
              <div key={z.id} className="flex justify-between border-b border-border/40 py-1 text-xs">
                <span>{z.code} · {ZONE_TYPE_LABELS[z.zoneType]}</span>
                <span>{z.utilizationPct}% · {z.binCount} bins</span>
              </div>
            ))
          )}
        </Section>

        <Section title="Bin hierarchy (zone → rack → shelf → bin)" icon={Package}>
          <div className="max-h-48 overflow-y-auto text-xs">
            {detail.hierarchy.slice(0, 20).map((h, i) => (
              <div key={i} className="flex justify-between border-b border-border/40 py-1 font-mono text-[10px]">
                <span>{h.zone}/{h.rack}/{h.shelf}/{h.bin}</span>
                <span>{h.usedKg}/{h.capacityKg || "∞"} kg</span>
              </div>
            ))}
          </div>
        </Section>

        <Section title="FEFO batches & traceability" icon={Package}>
          {detail.batches.slice(0, 8).map((b) => (
            <div key={b.id} className="flex justify-between border-b border-border/40 py-1 text-xs">
              <span>{b.batchNumber} · {b.productName} · {b.binCode ?? "—"}</span>
              <span>{b.qty} · {b.status}{b.expiryDate ? ` · exp ${formatDate(b.expiryDate)}` : ""}</span>
            </div>
          ))}
        </Section>

        <Section title="Warehouse staff" icon={Users}>
          {detail.staff.length === 0 ? (
            <p className="text-xs text-muted-foreground">No staff assignments.</p>
          ) : (
            detail.staff.map((s) => (
              <div key={s.id} className="flex justify-between border-b border-border/40 py-1 text-xs">
                <span>{s.name}</span>
                <span>{STAFF_ROLE_LABELS[s.role]}</span>
              </div>
            ))
          )}
        </Section>
      </div>

      {detail.forecast.length > 0 && (
        <div className="rounded-xl border border-border/60 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-medium"><BarChart3 className="h-4 w-4" /> AI replenishment forecast</p>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={detail.forecast}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Line type="monotone" dataKey="demand" stroke="#64748b" name="Demand" dot={false} />
              <Line type="monotone" dataKey="replenishment" stroke="#B68D40" name="Replenishment" dot={false} />
              <Line type="monotone" dataKey="aiOptimized" stroke="#059669" name="AI optimized" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {detail.environmental.length > 0 && (
        <Section title="Cold / humidity readings" icon={Thermometer}>
          {detail.environmental.map((r, i) => (
            <div key={i} className={cn("flex justify-between py-1 text-xs", !r.inRange && "text-red-600")}>
              <span>{formatDate(r.recordedAt)}</span>
              <span>{r.temperatureC ?? "—"}°C · {r.humidityPct ?? "—"}%</span>
            </div>
          ))}
        </Section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Transfers" icon={Truck}>
          {detail.transfers.map((t) => (
            <div key={t.id} className="text-xs">
              <span className={cn("mr-1 rounded px-1 py-0.5 text-[10px] font-semibold", TRANSFER_STATUS_STYLES[t.status])}>{TRANSFER_STATUS_LABELS[t.status]}</span>
              {t.transferNumber}: {t.fromWarehouse} → {t.toWarehouse}
            </div>
          ))}
        </Section>
        <Section title="Dispatch" icon={Truck}>
          {detail.dispatches.map((d) => (
            <div key={d.id} className="text-xs">
              <span className={cn("mr-1 rounded px-1 py-0.5 text-[10px] font-semibold", DISPATCH_STATUS_STYLES[d.status])}>{DISPATCH_STATUS_LABELS[d.status]}</span>
              {d.dispatchNumber} · LR {d.lrNumber ?? "—"}
            </div>
          ))}
        </Section>
      </div>

      {detail.tasks.length > 0 && (
        <Section title="Open tasks (putaway · picking · cycle count)" icon={Package}>
          {detail.tasks.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-border/40 py-2 text-xs">
              <span>{TASK_TYPE_LABELS[t.taskType]} — {t.title} · {TASK_STATUS_LABELS[t.status]}</span>
              {canEdit && t.status !== "COMPLETED" && (
                <Button size="sm" variant="ghost" className="h-7" disabled={pending} onClick={() => handleCompleteTask(t.id)}>Complete</Button>
              )}
            </div>
          ))}
        </Section>
      )}
    </div>
  );
}

function MiniKpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border/60 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
    </motion.div>
  );
}

function Section({ title, icon: Icon, children }: { title: string; icon: typeof Package; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <p className="mb-2 flex items-center gap-2 text-sm font-medium"><Icon className="h-4 w-4" strokeWidth={ICON_STROKE} />{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}
