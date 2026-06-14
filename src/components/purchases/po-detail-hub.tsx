"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Package,
  Send,
  Truck,
} from "lucide-react";
import type { PoDetailDto } from "@/lib/po-types";
import {
  EXECUTION_WORKFLOW,
  PO_LIFECYCLE,
  PO_STATUS_LABELS,
  PO_STATUS_STYLES,
  SHIPMENT_STATUS_LABELS,
} from "@/lib/po-types";
import { TAMARIND_GRADE_LABELS } from "@/lib/vendor-types";
import {
  approvePoLevel,
  cancelPurchaseOrder,
  markPoPaid,
  receivePurchaseGoods,
  recordPoBill,
  sendPurchaseOrder,
} from "@/actions/po";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { toast } from "sonner";

export function PoDetailHub({ po }: { po: PoDetailDto }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const lifecycleIdx = PO_LIFECYCLE.indexOf(po.poStatus);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success("Updated");
        router.refresh();
      } else toast.error(r.error ?? "Failed");
    });
  };

  return (
    <div className="space-y-6">
      {po.budgetWarning && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">{po.budgetWarning}</div>
      )}
      {po.isDelayed && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm flex items-center gap-2">
          <AlertTriangle className="h-4 w-4" />
          Delivery delayed by {po.delayDays} day(s) — {SHIPMENT_STATUS_LABELS[po.shipmentStatus]}
        </div>
      )}

      <div className="erp-kpi-card flex flex-wrap gap-2 p-4">
        {PO_LIFECYCLE.filter((s) => s !== "CANCELLED" || po.poStatus === "CANCELLED").map((s, i) => (
          <div
            key={s}
            className={cn(
              "rounded-lg px-3 py-2 text-xs font-medium",
              i <= lifecycleIdx ? PO_STATUS_STYLES[s] : "bg-muted/50 text-muted-foreground",
            )}
          >
            {PO_STATUS_LABELS[s]}
          </div>
        ))}
      </div>

      <div className="erp-kpi-card p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Execution workflow</p>
        <div className="flex flex-wrap gap-2">
          {EXECUTION_WORKFLOW.map((step, i) => (
            <div
              key={step.key}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-medium",
                i <= po.workflowStep ? "bg-[#B68D40]/15 text-[#967235]" : "bg-muted text-muted-foreground",
              )}
            >
              {step.label}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {po.poStatus === "DRAFT" && (
          <Button type="button" size="sm" disabled={pending} onClick={() => run(() => sendPurchaseOrder(po.id))}>
            <Send className="mr-1.5 h-4 w-4" />
            Send PO
          </Button>
        )}
        {["SENT", "APPROVED", "PARTIALLY_RECEIVED"].includes(po.poStatus) && (
          <>
            <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => run(() => receivePurchaseGoods(po.id, 50))}>
              Partial GRN (50%)
            </Button>
            <Button type="button" size="sm" disabled={pending} onClick={() => run(() => receivePurchaseGoods(po.id, 100))}>
              <Package className="mr-1.5 h-4 w-4" />
              Full GRN
            </Button>
          </>
        )}
        {po.poStatus === "FULLY_RECEIVED" && !po.billUrl && (
          <Button type="button" size="sm" disabled={pending} onClick={() => run(() => recordPoBill(po.id))}>
            <FileText className="mr-1.5 h-4 w-4" />
            Record bill
          </Button>
        )}
        {po.poStatus === "BILLED" && (
          <Button type="button" size="sm" disabled={pending} onClick={() => run(() => markPoPaid(po.id))}>
            Mark paid
          </Button>
        )}
        {po.rfqId && (
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href={`/procurement/rfq/${po.rfqId}`}>RFQ {po.rfqNumber}</Link>
          </Button>
        )}
        {po.grn && (
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href="/procurement/grn">{po.grn.grnNumber}</Link>
          </Button>
        )}
        {!["PAID", "CANCELLED"].includes(po.poStatus) && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => cancelPurchaseOrder(po.id))}>
            Cancel
          </Button>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Vendor SLA on-time" value={`${po.vendorSla.onTimePct}%`} />
        <Stat label="Quality score" value={`${po.vendorSla.qualityScore}`} />
        <Stat label="Received" value={`${po.receivedPct}%`} />
        <Stat label="Yield forecast" value={po.yieldForecastPct != null ? `${po.yieldForecastPct}%` : "—"} />
      </div>

      <div className="erp-kpi-card p-5">
        <h3 className="text-sm font-semibold">Approvals</h3>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {(["procurement", "finance", "inventory", "budget"] as const).map((key) => (
            <div key={key} className="rounded-lg border border-border/60 p-3">
              <p className="text-xs capitalize text-muted-foreground">{key}</p>
              <p className="font-semibold">{po.approvals[key]}</p>
              {po.approvals[key] === "PENDING" && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="mt-2 h-7 text-xs"
                  disabled={pending}
                  onClick={() =>
                    run(() =>
                      approvePoLevel(po.id, key.toUpperCase() as "PROCUREMENT" | "FINANCE" | "INVENTORY" | "BUDGET", "APPROVED"),
                    )
                  }
                >
                  Approve
                </Button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="erp-kpi-card p-5">
        <h3 className="text-sm font-semibold">Line items — raw material intelligence</h3>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="border-b text-[11px] uppercase text-muted-foreground">
              <tr>
                <th className="py-2 text-left">Material</th>
                <th className="py-2 text-left">Qty</th>
                <th className="py-2 text-left">Price</th>
                <th className="py-2 text-left">Tax</th>
                <th className="py-2 text-left">Freight</th>
                <th className="py-2 text-left">Grade</th>
                <th className="py-2 text-left">Moisture</th>
                <th className="py-2 text-left">Yield</th>
                <th className="py-2 text-left">Batch</th>
                <th className="py-2 text-left">Recv</th>
              </tr>
            </thead>
            <tbody>
              {po.lineItems.map((l) => (
                <tr key={l.id} className="border-b border-border/40">
                  <td className="py-3">
                    <span className="font-medium">{l.productName}</span>
                    <span className="block text-[10px] text-muted-foreground">{l.sku}</span>
                  </td>
                  <td className="py-3">{l.quantity}</td>
                  <td className="py-3">{formatInr(l.unitPrice)}</td>
                  <td className="py-3 text-xs">{l.gstPercent}% · {formatInr(l.gstAmount)}</td>
                  <td className="py-3">{formatInr(l.freightAmount)}</td>
                  <td className="py-3 text-xs">{l.tamarindGrade ? TAMARIND_GRADE_LABELS[l.tamarindGrade] : "—"}</td>
                  <td className="py-3">{l.moisturePct != null ? `${l.moisturePct}%` : "—"}</td>
                  <td className="py-3">{l.expectedYieldPct != null ? `${l.expectedYieldPct}%` : "—"}</td>
                  <td className="py-3 font-mono text-xs">{l.batchNumber ?? "—"}</td>
                  <td className="py-3">{l.receivedQty}/{l.quantity}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{po.seasonalInsight}</p>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="erp-kpi-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold">Timeline</h3>
          <ul className="mt-4 space-y-2">
            {po.timeline.length === 0 ? (
              <li className="text-sm text-muted-foreground">No events yet</li>
            ) : (
              po.timeline.map((e) => (
                <li key={e.id} className="flex gap-2 border-l-2 border-[#B68D40]/30 pl-3 text-sm">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#B68D40]" />
                  <div>
                    <p className="font-medium">{e.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(new Date(e.createdAt))}</p>
                  </div>
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="erp-kpi-card space-y-3 p-5">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <Truck className="h-4 w-4" />
            Delivery
          </h3>
          <p className="text-sm">Transporter: {po.transporter ?? "—"}</p>
          <p className="text-sm">Expected: {po.expectedDelivery ? formatDate(new Date(po.expectedDelivery)) : "—"}</p>
          <p className="text-sm">Warehouse: {po.warehouseName ?? "—"}</p>
          <p className="text-sm font-semibold">{formatInr(po.total)}</p>
          <p className="text-xs text-muted-foreground">Payment: {po.paymentStatus}</p>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="erp-kpi-card p-4">
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}
