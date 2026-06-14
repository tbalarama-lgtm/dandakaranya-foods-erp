"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Smartphone } from "lucide-react";
import { markDeliveryReceived } from "@/actions/grn";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function GrnMobileReceive({
  awaiting,
}: {
  awaiting: { id: string; purchaseNumber: string; vendorName: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [scanRef, setScanRef] = useState("");

  function receive(purchaseId: string) {
    startTransition(async () => {
      const res = await markDeliveryReceived(purchaseId);
      if (res.ok) {
        toast.success("Delivery received — GRN created");
        window.location.href = `/procurement/grn/${res.data.grnId}`;
      } else toast.error(res.error);
    });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <div className="rounded-2xl border border-border/60 bg-muted/20 p-6 text-center">
        <Smartphone className="mx-auto h-10 w-10 text-[#B68D40]" />
        <h2 className="mt-3 text-lg font-semibold">Mobile warehouse receiving</h2>
        <p className="mt-1 text-sm text-muted-foreground">Scan PO barcode or select a delivered order to start GRN intake.</p>
        <input
          type="text"
          value={scanRef}
          onChange={(e) => setScanRef(e.target.value)}
          placeholder="Scan PO / GRN reference…"
          className="mt-4 h-12 w-full rounded-xl border border-border bg-background px-4 text-center font-mono text-sm"
        />
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Delivered POs awaiting GRN</p>
        {awaiting.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pending deliveries.</p>
        ) : (
          awaiting.map((po) => (
            <div key={po.id} className="flex items-center justify-between rounded-xl border border-border/60 p-4">
              <div>
                <p className="font-mono text-sm font-medium">{po.purchaseNumber}</p>
                <p className="text-xs text-muted-foreground">{po.vendorName}</p>
              </div>
              <Button type="button" size="sm" disabled={pending} onClick={() => receive(po.id)}>
                Receive
              </Button>
            </div>
          ))
        )}
      </div>

      <Button type="button" variant="outline" className="w-full" asChild>
        <Link href="/procurement/grn">Back to GRN hub</Link>
      </Button>
    </div>
  );
}
