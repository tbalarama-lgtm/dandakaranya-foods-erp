"use client";

import Link from "next/link";
import { useTransition } from "react";
import { ArrowLeft } from "lucide-react";
import type { ProductionStage } from "@prisma/client";
import {
  completeProductionStage,
  releaseProductionOrder,
  startProductionStage,
  submitBatchQc,
} from "@/actions/production-workflow";
import type { ProductionBatchDetail } from "@/lib/production-types";
import {
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUS_STYLES,
  STAGE_LABELS,
  UTILITY_LABELS,
} from "@/lib/production-types";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { toast } from "sonner";

export function ProductionDetailHub({ detail, canEdit }: { detail: ProductionBatchDetail; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();

  function act(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(label);
      else toast.error(res.error ?? "Failed");
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/production" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> MES control center
      </Link>

      <div className="flex flex-wrap items-center gap-2">
        <h2 className="text-2xl font-semibold">{detail.batchCode}</h2>
        <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", PRODUCTION_STATUS_STYLES[detail.status])}>
          {PRODUCTION_STATUS_LABELS[detail.status]}
        </span>
        {detail.currentStage && (
          <span className="rounded-md bg-sky-500/12 px-2 py-0.5 text-xs font-semibold text-sky-700">
            {STAGE_LABELS[detail.currentStage]}
          </span>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Mini label="Product" value={detail.productName} sub={detail.recipeName} />
        <Mini label="Planned / actual" value={`${detail.plannedQty} kg`} sub={detail.actualQty != null ? `Actual ${detail.actualQty} kg` : "—"} />
        <Mini label="Yield" value={`${detail.actualYieldPct ?? detail.expectedYieldPct}%`} sub={`Waste ${detail.wastageQty} · Recovery ${detail.recoveryQty}`} />
        <Mini label="Total cost" value={formatInr(detail.totalCost)} sub={`Mat ${formatInr(detail.materialCost)} · Lab ${formatInr(detail.laborCost)}`} />
      </div>

      {canEdit && (
        <div className="flex flex-wrap gap-2">
          {detail.status === "PLANNED" && (
            <Button size="sm" variant="premium" disabled={pending} onClick={() => act("Released", () => releaseProductionOrder(detail.id))}>Release order</Button>
          )}
          {detail.status === "RELEASED" && detail.currentStage && (
            <Button size="sm" variant="premium" disabled={pending} onClick={() => act("Started", () => startProductionStage(detail.id, detail.currentStage!))}>Start {STAGE_LABELS[detail.currentStage]}</Button>
          )}
          {detail.status === "IN_PROGRESS" && detail.currentStage && (
            <Button size="sm" variant="secondary" disabled={pending} onClick={() => act("Stage done", () => completeProductionStage(detail.id, detail.currentStage!))}>Complete stage</Button>
          )}
          {detail.status === "QC" && (
            <>
              <Button size="sm" variant="premium" disabled={pending} onClick={() => act("QC passed", () => submitBatchQc(detail.id, true))}>Pass QC</Button>
              <Button size="sm" variant="secondary" disabled={pending} onClick={() => act("Rejected", () => submitBatchQc(detail.id, false))}>Reject</Button>
            </>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Section title="Production stages">
          {(["MIXING", "HEATING", "DRYING", "GRINDING", "PACKING"] as ProductionStage[]).map((stage) => {
            const ev = detail.stages.find((s) => s.stage === stage);
            return (
              <div key={stage} className="flex justify-between border-b border-border/40 py-1 text-xs">
                <span>{STAGE_LABELS[stage]}</span>
                <span className="text-muted-foreground">{ev?.completedAt ? "Done" : ev?.startedAt ? "In progress" : "—"} · {ev?.operatorName ?? "—"}</span>
              </div>
            );
          })}
        </Section>
        <Section title="MRP / materials">
          {detail.materials.length === 0 ? (
            <p className="text-xs text-muted-foreground">No material requirements.</p>
          ) : (
            detail.materials.map((m, i) => (
              <div key={i} className={cn("flex justify-between py-1 text-xs", m.shortageQty > 0 && "text-amber-800")}>
                <span>{m.productName}</span>
                <span>{m.requiredQty} req · {m.shortageQty} short {m.unit}</span>
              </div>
            ))
          )}
        </Section>
        <Section title="Batch costing">
          <CostRow label="Material" value={detail.materialCost} />
          <CostRow label="Labor" value={detail.laborCost} />
          <CostRow label="Machine" value={detail.machineCost} />
          <CostRow label="Utilities" value={detail.utilityCost} />
        </Section>
        <Section title="Utilities">
          {detail.utilities.map((u, i) => (
            <div key={i} className="flex justify-between py-1 text-xs">
              <span>{UTILITY_LABELS[u.type]}</span>
              <span>{u.quantity} {u.unit}{u.cost != null ? ` · ${formatInr(u.cost)}` : ""}</span>
            </div>
          ))}
        </Section>
        <Section title="Compliance (FSSAI / HACCP)">
          {detail.compliance.map((c, i) => (
            <div key={i} className="flex justify-between py-1 text-xs">
              <span>{c.standard}</span>
              <span className={c.passed ? "text-emerald-700" : "text-red-600"}>{c.passed ? "Pass" : "Fail"} · {formatDate(c.auditedAt)}</span>
            </div>
          ))}
        </Section>
        <Section title="Operators & shifts">
          {detail.operators.map((o, i) => (
            <div key={i} className="flex justify-between py-1 text-xs">
              <span>{o.name} ({o.role})</span>
              <span>OT {o.overtimeHours}h</span>
            </div>
          ))}
        </Section>
      </div>

      {detail.scheduledStart && (
        <p className="text-xs text-muted-foreground">
          Scheduled {formatDate(detail.scheduledStart)} → {detail.scheduledEnd ? formatDate(detail.scheduledEnd) : "—"} · {detail.branchName ?? "—"} · {detail.machineName ?? "—"}
        </p>
      )}
    </div>
  );
}

function Mini({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/60 p-4">
      <p className="mb-2 text-sm font-medium">{title}</p>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function CostRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between py-1 text-xs">
      <span>{label}</span>
      <span>{formatInr(value)}</span>
    </div>
  );
}
