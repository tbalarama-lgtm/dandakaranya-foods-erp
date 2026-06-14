"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Package,
  QrCode,
  RotateCcw,
  ShieldCheck,
  Warehouse,
  XCircle,
} from "lucide-react";
import {
  allocateGrnToWarehouse,
  approveGrnQc,
  initiateVendorReturn,
  postGrnToStock,
  quarantineGrn,
  recordQcInspection,
  rejectGrnQc,
  releaseFromQuarantine,
  startQcInspection,
} from "@/actions/grn";
import type { GrnDetailDto } from "@/lib/grn-types";
import {
  COMPLIANCE_LABELS,
  GRN_LIFECYCLE_LABELS,
  GRN_LIFECYCLE_STYLES,
  GRN_WORKFLOW_STEPS,
  QC_ITEM_STATUS_LABELS,
  ROTATION_LABELS,
  evaluateQcAgainstThresholds,
} from "@/lib/grn-types";
import { codesToDataUri, qrSvg, barcodeSvg } from "@/lib/grn-codes";
import { TAMARIND_GRADE_LABELS } from "@/lib/vendor-types";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { toast } from "sonner";

export function GrnDetailHub({ grn, canEdit }: { grn: GrnDetailDto; canEdit: boolean }) {
  const [pending, startTransition] = useTransition();
  const [moisture, setMoisture] = useState(String(grn.moisturePct ?? ""));
  const [acidity, setAcidity] = useState(String(grn.acidityPct ?? ""));
  const [pulpYield, setPulpYield] = useState(String(grn.pulpYieldPct ?? ""));
  const [seedRatio, setSeedRatio] = useState(String(grn.seedRatioPct ?? ""));
  const [foreignMatter, setForeignMatter] = useState(String(grn.foreignMatterPct ?? ""));
  const [microbialPass, setMicrobialPass] = useState(grn.microbialPass ?? true);
  const [qcNotes, setQcNotes] = useState(grn.qcNotes ?? "");
  const [binSelections, setBinSelections] = useState<Record<string, string>>({});

  const qcEval = evaluateQcAgainstThresholds({
    moisturePct: moisture ? Number(moisture) : null,
    seedRatioPct: seedRatio ? Number(seedRatio) : null,
    pulpYieldPct: pulpYield ? Number(pulpYield) : null,
    foreignMatterPct: foreignMatter ? Number(foreignMatter) : null,
  });

  function run(action: () => Promise<{ ok: boolean; error?: string }>, success: string) {
    startTransition(async () => {
      const res = await action();
      if (res.ok) toast.success(success);
      else toast.error(res.error ?? "Action failed");
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border/60 bg-muted/20 p-4">
        <div className="flex flex-wrap items-center gap-2">
          {GRN_WORKFLOW_STEPS.map((step, i) => (
            <div key={step.key} className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  i <= grn.workflowStep ? "bg-[#B68D40]/20 text-[#8B6914]" : "bg-muted text-muted-foreground",
                )}
              >
                {step.label}
              </span>
              {i < GRN_WORKFLOW_STEPS.length - 1 && <span className="text-muted-foreground">→</span>}
            </div>
          ))}
        </div>
        <p className="mt-3 text-sm">
          <span className={cn("rounded-md px-2 py-0.5 text-xs font-semibold", GRN_LIFECYCLE_STYLES[grn.lifecycle])}>
            {GRN_LIFECYCLE_LABELS[grn.lifecycle]}
          </span>
          <span className="ml-3 text-muted-foreground">{grn.gradeIntelligence}</span>
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <InfoCard title="Receipt" icon={Package}>
          <Row label="PO" value={<Link href={`/purchases/${grn.purchaseId}`} className="text-[#B68D40] hover:underline">{grn.purchaseNumber}</Link>} />
          <Row label="Vendor" value={grn.vendorName} />
          <Row label="Warehouse" value={grn.warehouseName ?? "—"} />
          <Row label="Intake value" value={formatInr(grn.intakeValue)} />
          <Row label="Rotation" value={ROTATION_LABELS[grn.stockRotation]} />
          <Row label="Received" value={grn.receivedAt ? formatDate(new Date(grn.receivedAt)) : "—"} />
        </InfoCard>

        <InfoCard title="QC parameters" icon={ShieldCheck}>
          <Row label="Moisture" value={grn.moisturePct != null ? `${grn.moisturePct}%` : "—"} />
          <Row label="Acidity" value={grn.acidityPct != null ? `${grn.acidityPct}%` : "—"} />
          <Row label="Pulp yield" value={grn.pulpYieldPct != null ? `${grn.pulpYieldPct}%` : "—"} />
          <Row label="Seed ratio" value={grn.seedRatioPct != null ? `${grn.seedRatioPct}%` : "—"} />
          <Row label="Foreign matter" value={grn.foreignMatterPct != null ? `${grn.foreignMatterPct}%` : "—"} />
          <Row label="Grade" value={grn.tamarindGrade ? TAMARIND_GRADE_LABELS[grn.tamarindGrade] : "—"} />
          <Row label="QC officer" value={grn.qcOfficerName ?? "—"} />
        </InfoCard>

        <InfoCard title="Compliance & trace" icon={QrCode}>
          <div className="flex gap-3">
            {grn.qrCodeData && (
              <img src={codesToDataUri(qrSvg(grn.qrCodeData))} alt="GRN QR" className="h-20 w-20 rounded border bg-white p-1" />
            )}
            {grn.barcodeData && (
              <img src={codesToDataUri(barcodeSvg(grn.barcodeData))} alt="GRN barcode" className="h-20 flex-1 rounded border bg-white object-contain p-1" />
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-1">
            {grn.fssaiCompliant && <Badge ok>FSSAI</Badge>}
            {grn.haccpCompliant && <Badge ok>HACCP</Badge>}
            {grn.isoCompliant && <Badge ok>ISO</Badge>}
          </div>
          {grn.mobileReceiptRef && <Row label="Mobile ref" value={grn.mobileReceiptRef} />}
          <p className="mt-2 text-xs text-muted-foreground">{grn.seasonalInsight}</p>
        </InfoCard>
      </div>

      {canEdit && (
        <div className="rounded-xl border border-border/60 p-4">
          <p className="mb-3 font-semibold">QC inspection workspace</p>
          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                ["Moisture %", moisture, setMoisture],
                ["Acidity %", acidity, setAcidity],
                ["Pulp yield %", pulpYield, setPulpYield],
                ["Seed ratio %", seedRatio, setSeedRatio],
                ["Foreign matter %", foreignMatter, setForeignMatter],
              ] as [string, string, (v: string) => void][]
            ).map(([label, val, set]) => (
              <label key={label} className="text-xs">
                {label}
                <input
                  type="number"
                  step="0.1"
                  value={val}
                  onChange={(e) => set(e.target.value)}
                  className="mt-1 h-9 w-full rounded-lg border border-border bg-background px-2 text-sm"
                />
              </label>
            ))}
            <label className="flex items-end gap-2 text-xs">
              <input type="checkbox" checked={microbialPass} onChange={(e) => setMicrobialPass(e.target.checked)} />
              Microbial pass
            </label>
          </div>
          <textarea
            value={qcNotes}
            onChange={(e) => setQcNotes(e.target.value)}
            placeholder="QC notes…"
            className="mt-3 min-h-[60px] w-full rounded-lg border border-border bg-background p-2 text-sm"
          />
          {!qcEval.passed && (
            <p className="mt-2 flex items-start gap-2 text-xs text-amber-800">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              {qcEval.alerts.join(" · ")}
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => startQcInspection(grn.id), "QC started")}>
              Start QC
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                run(
                  () =>
                    recordQcInspection(grn.id, {
                      moisturePct: moisture ? Number(moisture) : undefined,
                      acidityPct: acidity ? Number(acidity) : undefined,
                      pulpYieldPct: pulpYield ? Number(pulpYield) : undefined,
                      seedRatioPct: seedRatio ? Number(seedRatio) : undefined,
                      foreignMatterPct: foreignMatter ? Number(foreignMatter) : undefined,
                      microbialPass,
                      qcNotes,
                    }),
                  "Inspection recorded",
                )
              }
            >
              Save inspection
            </Button>
            <Button type="button" size="sm" disabled={pending} onClick={() => run(() => approveGrnQc(grn.id), "QC approved")}>
              <CheckCircle2 className="mr-1 h-4 w-4" /> Approve
            </Button>
            <Button type="button" size="sm" variant="destructive" disabled={pending} onClick={() => run(() => rejectGrnQc(grn.id, qcNotes || "Failed spec"), "QC rejected")}>
              <XCircle className="mr-1 h-4 w-4" /> Reject
            </Button>
            <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => quarantineGrn(grn.id, qcNotes || "Hold"), "Quarantined")}>
              Quarantine
            </Button>
            {grn.lifecycle === "QUARANTINE" && (
              <Button type="button" size="sm" variant="outline" disabled={pending} onClick={() => run(() => releaseFromQuarantine(grn.id), "Released")}>
                <RotateCcw className="mr-1 h-4 w-4" /> Release
              </Button>
            )}
          </div>
        </div>
      )}

      <div className="erp-table-shell overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b bg-muted/80 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Product</th>
              <th className="px-4 py-3">Ord / Rec / Dmg / Rej</th>
              <th className="px-4 py-3">Batch trace</th>
              <th className="px-4 py-3">QC</th>
              <th className="px-4 py-3">Bin (FIFO/FEFO)</th>
              <th className="px-4 py-3">Labels</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {grn.lineItems.map((item) => (
              <tr key={item.id} className="erp-table-row">
                <td className="px-4 py-3">
                  <p className="font-medium">{item.productName}</p>
                  <p className="text-xs text-muted-foreground">{item.sku}</p>
                </td>
                <td className="px-4 py-3 font-mono text-xs">
                  {item.orderedQty} / {item.receivedQty} / {item.damagedQty} / {item.rejectedQty}
                </td>
                <td className="px-4 py-3 text-xs">
                  <p>Sup: {item.supplierBatch ?? "—"}</p>
                  <p>WH: {item.warehouseBatch ?? "—"}</p>
                  <p className="font-mono text-[10px] text-muted-foreground">{item.traceCode ?? "—"}</p>
                </td>
                <td className="px-4 py-3 text-xs">{QC_ITEM_STATUS_LABELS[item.qcStatus]}</td>
                <td className="px-4 py-3">
                  {canEdit && grn.bins.length > 0 ? (
                    <select
                      value={binSelections[item.id] ?? ""}
                      onChange={(e) => setBinSelections((s) => ({ ...s, [item.id]: e.target.value }))}
                      className="h-8 rounded border border-border bg-background px-2 text-xs"
                    >
                      <option value="">Select bin</option>
                      {grn.bins.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.code} {b.zone ? `(${b.zone})` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    item.binCode ?? "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.traceCode && (
                    <img src={codesToDataUri(qrSvg(item.traceCode))} alt="" className="h-10 w-10 rounded border bg-white" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && grn.bins.length > 0 && grn.qcPassed && !grn.stockUpdated && (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => {
              const allocations = Object.entries(binSelections)
                .filter(([, binId]) => binId)
                .map(([grnItemId, binId]) => ({ grnItemId, binId }));
              if (!allocations.length) {
                toast.error("Select bins for line items");
                return;
              }
              run(() => allocateGrnToWarehouse(grn.id, allocations), "Bins allocated");
            }}
          >
            <Warehouse className="mr-1 h-4 w-4" /> Allocate bins
          </Button>
          <Button type="button" size="sm" disabled={pending} onClick={() => run(() => postGrnToStock(grn.id), "Stock updated")}>
            Post to stock
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => run(() => initiateVendorReturn(grn.id, { quantity: 1, reason: qcNotes || "QC reject" }), "RTV initiated")}
          >
            Return to vendor
          </Button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Timeline events={grn.timeline} />
        <div className="space-y-3">
          <p className="text-sm font-semibold">QC inspection log</p>
          {grn.inspections.map((ins) => (
            <div key={ins.id} className="rounded-lg border border-border/50 px-3 py-2 text-xs">
              <p className="font-medium">{ins.step.replace(/_/g, " ")}</p>
              <p className="text-muted-foreground">{ins.officerName ?? "System"} · {formatDate(new Date(ins.completedAt))}</p>
              {ins.notes && <p className="mt-1">{ins.notes}</p>}
            </div>
          ))}
          {grn.complianceLogs.map((c) => (
            <div key={c.id} className="rounded-lg border border-border/50 px-3 py-2 text-xs">
              {COMPLIANCE_LABELS[c.standard]} audit — {c.passed ? "Passed" : "Failed"} · {formatDate(new Date(c.auditedAt))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InfoCard({ title, icon: Icon, children }: { title: string; icon: typeof Package; children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border/60 p-4">
      <p className="mb-3 flex items-center gap-2 font-semibold">
        <Icon className="h-4 w-4 text-[#B68D40]" strokeWidth={ICON_STROKE} />
        {title}
      </p>
      <div className="space-y-2 text-sm">{children}</div>
    </motion.div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  );
}

function Badge({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", ok ? "bg-emerald-500/12 text-emerald-700" : "bg-red-500/12 text-red-700")}>
      {children}
    </span>
  );
}

function Timeline({ events }: { events: GrnDetailDto["timeline"] }) {
  return (
    <div>
      <p className="mb-3 text-sm font-semibold">Audit timeline</p>
      <div className="space-y-2">
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">No events yet.</p>
        ) : (
          events.map((e) => (
            <div key={e.id} className="border-l-2 border-[#B68D40]/40 pl-3 text-xs">
              <p className="font-medium">{e.title}</p>
              {e.detail && <p className="text-muted-foreground">{e.detail}</p>}
              <p className="text-[10px] text-muted-foreground">{formatDate(new Date(e.createdAt))}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
