"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Truck } from "lucide-react";
import type { PickPackStatus } from "@prisma/client";
import { advanceDispatchStatus } from "@/actions/warehouse-workflow";
import type { DispatchRow } from "@/lib/warehouse-types";
import { DISPATCH_STATUS_LABELS, DISPATCH_STATUS_STYLES } from "@/lib/warehouse-types";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";

const FLOW: PickPackStatus[] = ["PENDING", "APPROVED", "PICKING", "PACKED", "READY_TO_DISPATCH", "DISPATCHED", "DELIVERED"];

export function DispatchOpsHub({
  dispatches,
  canEdit,
}: {
  dispatches: DispatchRow[];
  canEdit: boolean;
}) {
  const [filter, setFilter] = useState<PickPackStatus | "">("");
  const [pending, startTransition] = useTransition();

  const filtered = filter ? dispatches.filter((d) => d.status === filter) : dispatches;

  function advance(id: string, current: PickPackStatus) {
    const idx = FLOW.indexOf(current);
    const next = FLOW[idx + 1];
    if (!next) return;
    startTransition(async () => {
      const res = await advanceDispatchStatus(id, next, {
        transporterName: next === "DISPATCHED" ? "Dandakaranya Logistics" : undefined,
        lrNumber: next === "DISPATCHED" ? `LR-${Date.now().toString().slice(-6)}` : undefined,
        dockBay: next === "READY_TO_DISPATCH" ? "Bay-1" : undefined,
      });
      if (res.ok) toast.success(`Advanced to ${DISPATCH_STATUS_LABELS[next]}`);
      else toast.error(res.error);
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/warehouses" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Warehouses
      </Link>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilter("")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", !filter ? "bg-[#B68D40] text-white" : "bg-muted")}>All</button>
        {(["PENDING", "PICKING", "PACKED", "DISPATCHED"] as PickPackStatus[]).map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", filter === s ? "bg-[#B68D40] text-white" : "bg-muted")}>
            {DISPATCH_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((d) => (
          <div key={d.id} className="rounded-xl border border-border/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{d.dispatchNumber}</span>
                  <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", DISPATCH_STATUS_STYLES[d.status])}>{DISPATCH_STATUS_LABELS[d.status]}</span>
                </div>
                <p className="mt-1 text-sm">{d.warehouseName ?? "—"} · {d.lineCount} lines · {d.totalQty} units</p>
                <p className="text-xs text-muted-foreground">Pick {d.pickedPct}% · Created {formatDate(d.createdAt)}</p>
                {(d.transporterName || d.lrNumber || d.dockBay) && (
                  <p className="mt-1 text-xs"><Truck className="mr-1 inline h-3 w-3" />{d.transporterName ?? "—"} · LR {d.lrNumber ?? "—"} · Dock {d.dockBay ?? "—"}</p>
                )}
              </div>
              {canEdit && FLOW.indexOf(d.status) < FLOW.length - 1 && (
                <Button size="sm" variant="premium" disabled={pending} onClick={() => advance(d.id, d.status)}>
                  → {DISPATCH_STATUS_LABELS[FLOW[FLOW.indexOf(d.status) + 1]!]}
                </Button>
              )}
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
              <div className="h-full rounded-full bg-[#B68D40]" style={{ width: `${d.pickedPct}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
