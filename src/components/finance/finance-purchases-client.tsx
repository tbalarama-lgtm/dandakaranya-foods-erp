"use client";

import type { PurchaseRecord } from "@/lib/finance/types";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { PaymentStatusBadge } from "@/components/finance/payment-status-badge";
import { FinanceExportButtons } from "@/components/finance/finance-export-buttons";
import { formatInr } from "@/lib/utils";
import { toast } from "sonner";

export function FinancePurchasesClient({ purchases }: { purchases: PurchaseRecord[] }) {
  const pending = purchases.filter((p) => p.approvalStatus === "PENDING");

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <FinanceExportButtons filename="purchases" />
      </div>
      {pending.length > 0 && (
        <GlassCard glow="amber">
          <GlassCardHeader>
            <h3 className="font-semibold">Pending approvals ({pending.length})</h3>
          </GlassCardHeader>
          <GlassCardBody className="space-y-2">
            {pending.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3">
                <div>
                  <p className="font-medium">{p.purchaseNumber}</p>
                  <p className="text-sm text-muted-foreground">{p.vendorName} · {formatInr(p.total)}</p>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => toast.success("Approved")}>
                    Approve
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => toast.error("Rejected")}>
                    Reject
                  </Button>
                </div>
              </div>
            ))}
          </GlassCardBody>
        </GlassCard>
      )}
      <GlassCard>
        <GlassCardBody className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-2">PO</th>
                <th className="px-4 py-2">Vendor</th>
                <th className="px-4 py-2">Total</th>
                <th className="px-4 py-2">Payment</th>
                <th className="px-4 py-2">Approval</th>
                <th className="px-4 py-2">GRN</th>
              </tr>
            </thead>
            <tbody>
              {purchases.map((p) => (
                <tr key={p.id} className="border-b border-border/40">
                  <td className="px-4 py-2 font-medium">{p.purchaseNumber}</td>
                  <td className="px-4 py-2">{p.vendorName}</td>
                  <td className="px-4 py-2">{formatInr(p.total)}</td>
                  <td className="px-4 py-2">
                    <PaymentStatusBadge status={p.paymentStatus} />
                  </td>
                  <td className="px-4 py-2">
                    <PaymentStatusBadge status={p.approvalStatus} />
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{p.grnStatus}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}
