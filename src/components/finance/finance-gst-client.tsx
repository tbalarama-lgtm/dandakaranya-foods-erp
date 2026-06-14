"use client";

import type { GstSummary } from "@/lib/finance/types";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { FinanceExportButtons } from "@/components/finance/finance-export-buttons";
import { FinanceStatCard } from "@/components/finance/finance-stat-card";
import { Scale, ArrowDownLeft, ArrowUpRight, Calendar } from "lucide-react";
import { formatInr } from "@/lib/utils";

export function FinanceGstClient({ gst }: { gst: GstSummary }) {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <FinanceExportButtons filename="gst-report" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <FinanceStatCard label="Output tax" value={formatInr(gst.outputTax)} icon={ArrowUpRight} accent="rose" />
        <FinanceStatCard label="Input credit (ITC)" value={formatInr(gst.inputTaxCredit)} icon={ArrowDownLeft} accent="emerald" />
        <FinanceStatCard label="Net GST payable" value={formatInr(gst.netPayable)} icon={Scale} accent="amber" />
        <FinanceStatCard label="TDS (placeholder)" value={formatInr(gst.tdsPlaceholder)} icon={Scale} accent="violet" />
      </div>
      <GlassCard>
        <GlassCardHeader className="flex flex-row items-center justify-between">
          <h3 className="font-semibold">Tax summary — May 2026</h3>
          <span className="flex items-center gap-1 text-sm text-amber-600">
            <Calendar className="h-4 w-4" />
            Filing due {gst.filingDueDate}
          </span>
        </GlassCardHeader>
        <GlassCardBody className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">CGST</p>
            <p className="text-xl font-semibold">{formatInr(gst.cgst)}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">SGST</p>
            <p className="text-xl font-semibold">{formatInr(gst.sgst)}</p>
          </div>
          <div className="rounded-xl bg-muted/40 p-4">
            <p className="text-xs text-muted-foreground">IGST</p>
            <p className="text-xl font-semibold">{formatInr(gst.igst)}</p>
          </div>
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}
