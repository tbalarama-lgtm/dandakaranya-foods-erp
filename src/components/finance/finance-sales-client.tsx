"use client";

import { useMemo, useState } from "react";
import { Search, Printer, FileDown } from "lucide-react";
import type { SalesInvoice } from "@/lib/finance/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardBody } from "@/components/dashboard/glass-card";
import { PaymentStatusBadge } from "@/components/finance/payment-status-badge";
import { FinanceExportButtons } from "@/components/finance/finance-export-buttons";
import { formatInr } from "@/lib/utils";
import { toast } from "sonner";

export function FinanceSalesClient({ invoices }: { invoices: SalesInvoice[] }) {
  const [q, setQ] = useState("");
  const filtered = useMemo(
    () =>
      invoices.filter(
        (i) =>
          !q ||
          i.invoiceNumber.toLowerCase().includes(q.toLowerCase()) ||
          i.customerName.toLowerCase().includes(q.toLowerCase()),
      ),
    [invoices, q],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Search invoices…" className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <FinanceExportButtons filename="sales-invoices" />
      </div>
      <GlassCard>
        <GlassCardBody className="overflow-x-auto p-0">
          <table className="w-full min-w-[960px] text-sm">
            <thead>
              <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                <th className="px-4 py-3">Invoice</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Products</th>
                <th className="px-4 py-3">Qty</th>
                <th className="px-4 py-3">Tax</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Due</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((inv) => (
                <tr key={inv.id} className="border-b border-border/40 hover:bg-muted/20">
                  <td className="px-4 py-3 font-medium">{inv.invoiceNumber}</td>
                  <td className="px-4 py-3">{inv.customerName}</td>
                  <td className="max-w-[180px] truncate px-4 py-3 text-muted-foreground">{inv.items}</td>
                  <td className="px-4 py-3">{inv.quantity}</td>
                  <td className="px-4 py-3">{formatInr(inv.tax)}</td>
                  <td className="px-4 py-3 font-semibold">{formatInr(inv.total)}</td>
                  <td className="px-4 py-3">
                    <PaymentStatusBadge status={inv.paymentStatus} />
                  </td>
                  <td className="px-4 py-3">{inv.dueDate}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-end gap-1">
                      <Button size="icon" variant="ghost" onClick={() => toast.success("PDF downloaded")}>
                        <FileDown className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => toast.info("Print dialog")}>
                        <Printer className="h-4 w-4" />
                      </Button>
                    </div>
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
