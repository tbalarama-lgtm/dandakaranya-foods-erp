"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { InventoryDetail } from "@/lib/inventory-types";
import {
  BATCH_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  QC_STATUS_LABELS,
  VALUATION_LABELS,
} from "@/lib/inventory-types";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function InventoryDetailHub({ detail }: { detail: InventoryDetail }) {
  const { product, batches, movements, reservations, auditLog, demandForecast } = detail;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/inventory"><ArrowLeft className="mr-1 h-4 w-4" />Stock hub</Link>
        </Button>
        <div>
          <h2 className="text-lg font-semibold">{product.name}</h2>
          <p className="font-mono text-xs text-muted-foreground" spellCheck={false}>{product.sku} · {VALUATION_LABELS[product.valuationMethod]} · {product.rotationPolicy}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-2xl font-semibold">{product.availableQty} {product.unit}</p>
          <p className="text-sm text-muted-foreground">{formatInr(product.stockValue)} · {product.reservedQty} reserved</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <Metric label="On hand" value={`${product.stockQty} ${product.unit}`} />
        <Metric label="Reorder point" value={`${product.reorderPoint} ${product.unit}`} />
        <Metric label="Safety stock" value={`${product.safetyStockQty} ${product.unit}`} />
        <Metric label="Batches" value={String(product.batchCount)} />
      </div>

      {demandForecast.length > 0 && (
        <div className="rounded-xl border p-4">
          <p className="mb-3 text-sm font-medium">Demand forecast & planning</p>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={demandForecast}>
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip />
                <Line type="monotone" dataKey="demand" stroke="#94a3b8" name="Planned" />
                <Line type="monotone" dataKey="aiForecast" stroke="#B68D40" name="AI forecast" />
                <Line type="monotone" dataKey="actual" stroke="#10b981" name="Actual" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Batch traceability (FEFO)">
          {batches.length === 0 ? (
            <p className="text-xs text-muted-foreground">No batches.</p>
          ) : (
            batches.map((b) => (
              <div key={b.id} className={cn("mb-2 rounded-lg border p-2 text-xs", b.daysToExpiry != null && b.daysToExpiry <= 30 && "border-orange-500/40 bg-orange-500/5")}>
                <p className="font-mono font-semibold" spellCheck={false}>{b.batchNumber}</p>
                <p className="text-muted-foreground">
                  {b.quantity} qty · {BATCH_STATUS_LABELS[b.inventoryStatus]} · QC {QC_STATUS_LABELS[b.qcStatus]}
                </p>
                <p className="text-muted-foreground">
                  Supplier: {b.supplierBatch ?? "—"} · Prod: {b.productionBatch ?? "—"} · Bin: {b.binCode ?? "—"}
                </p>
                {b.expiryDate && <p className="text-muted-foreground">Expiry {formatDate(b.expiryDate)}{b.daysToExpiry != null ? ` (${b.daysToExpiry}d)` : ""}</p>}
                {b.barcodeData && <img src={b.barcodeData} alt="Barcode" className="mt-1 h-8" />}
              </div>
            ))
          )}
        </Section>

        <Section title="Reservations">
          {reservations.length === 0 ? (
            <p className="text-xs text-muted-foreground">No active reservations.</p>
          ) : (
            reservations.map((r) => (
              <p key={r.id} className="text-xs">{r.purpose}: {r.quantity} {r.unit} · ref {r.referenceId ?? "—"}</p>
            ))
          )}
        </Section>
      </div>

      <Section title="Movement history">
        <div className="max-h-64 space-y-2 overflow-y-auto">
          {movements.map((m) => (
            <div key={m.id} className="border-l-2 border-[#B68D40]/40 pl-3 text-xs">
              <p className="font-medium">{MOVEMENT_TYPE_LABELS[m.type]} — {m.quantity} {m.unit}</p>
              <p className="text-muted-foreground">{formatDate(m.createdAt)} · {m.reference ?? "—"} · {m.warehouseName ?? ""}</p>
              {m.notes && <p className="text-muted-foreground">{m.notes}</p>}
            </div>
          ))}
        </div>
      </Section>

      {auditLog.length > 0 && (
        <Section title="Audit log">
          {auditLog.map((a) => (
            <p key={a.id} className="text-xs text-muted-foreground">{a.title} · {a.actorName ?? "System"} · {formatDate(a.createdAt)}</p>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <p className="mb-3 text-sm font-medium">{title}</p>
      {children}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
