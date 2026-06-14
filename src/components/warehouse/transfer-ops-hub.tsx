"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { ArrowLeft, Check, Package, Truck, X } from "lucide-react";
import type { WarehouseTransferStatus } from "@prisma/client";
import { approveTransfer, receiveTransfer, shipTransfer } from "@/actions/warehouse-workflow";
import type { TransferRow } from "@/lib/warehouse-types";
import { TRANSFER_STATUS_LABELS, TRANSFER_STATUS_STYLES } from "@/lib/warehouse-types";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import { toast } from "sonner";

export function TransferOpsHub({
  transfers,
  canEdit,
}: {
  transfers: TransferRow[];
  canEdit: boolean;
}) {
  const [filter, setFilter] = useState<WarehouseTransferStatus | "">("");
  const [pending, startTransition] = useTransition();

  const filtered = filter ? transfers.filter((t) => t.status === filter) : transfers;

  function act(label: string, fn: () => Promise<{ ok: boolean; error?: string }>) {
    startTransition(async () => {
      const res = await fn();
      if (res.ok) toast.success(label);
      else toast.error(res.error ?? "Action failed");
    });
  }

  return (
    <div className="space-y-6">
      <Link href="/warehouses" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Warehouses
      </Link>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setFilter("")} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", !filter ? "bg-[#B68D40] text-white" : "bg-muted")}>All</button>
        {(["PENDING_APPROVAL", "APPROVED", "IN_TRANSIT", "RECEIVED"] as WarehouseTransferStatus[]).map((s) => (
          <button key={s} type="button" onClick={() => setFilter(s)} className={cn("rounded-lg px-3 py-1.5 text-xs font-medium", filter === s ? "bg-[#B68D40] text-white" : "bg-muted")}>
            {TRANSFER_STATUS_LABELS[s]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filtered.map((t) => (
          <div key={t.id} className="rounded-xl border border-border/60 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{t.transferNumber}</span>
                  <span className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold", TRANSFER_STATUS_STYLES[t.status])}>{TRANSFER_STATUS_LABELS[t.status]}</span>
                </div>
                <p className="mt-1 text-sm">{t.fromWarehouse} → {t.toWarehouse}</p>
                <p className="text-xs text-muted-foreground">{t.itemCount} lines · {t.totalQty} units · Requested {formatDate(t.requestedAt)}</p>
                {(t.transporterName || t.lrNumber) && (
                  <p className="mt-1 text-xs"><Truck className="mr-1 inline h-3 w-3" />{t.transporterName ?? "—"} · LR {t.lrNumber ?? "—"} · {t.vehicleNumber ?? "—"}</p>
                )}
              </div>
              {canEdit && (
                <div className="flex flex-wrap gap-2">
                  {t.status === "PENDING_APPROVAL" && (
                    <>
                      <Button size="sm" variant="premium" disabled={pending} onClick={() => act("Approved", () => approveTransfer(t.id, true))}><Check className="h-3 w-3" /> Approve</Button>
                      <Button size="sm" variant="secondary" disabled={pending} onClick={() => act("Cancelled", () => approveTransfer(t.id, false))}><X className="h-3 w-3" /> Reject</Button>
                    </>
                  )}
                  {t.status === "APPROVED" && (
                    <Button size="sm" variant="premium" disabled={pending} onClick={() => act("Shipped", () => shipTransfer({ transferId: t.id, transporterName: "Network carrier", lrNumber: `LR-${t.transferNumber.slice(-4)}` }))}>Ship</Button>
                  )}
                  {t.status === "IN_TRANSIT" && (
                    <Button size="sm" variant="premium" disabled={pending} onClick={() => act("Received", () => receiveTransfer(t.id))}><Package className="h-3 w-3" /> Confirm receipt</Button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
