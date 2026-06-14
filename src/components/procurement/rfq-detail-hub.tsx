"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { motion } from "framer-motion";
import {
  Award,
  CheckCircle2,
  FileText,
  Gavel,
  Send,
  Sparkles,
  Star,
  Trophy,
} from "lucide-react";
import type { RfqDetailDto } from "@/lib/rfq-types";
import {
  AUCTION_MODE_LABELS,
  RFQ_LIFECYCLE,
  RFQ_STATUS_LABELS,
  RFQ_STATUS_STYLES,
  SOURCING_TYPE_LABELS,
} from "@/lib/rfq-types";
import { TAMARIND_GRADE_LABELS } from "@/lib/vendor-types";
import {
  approveRfqVendor,
  awardRfqVendor,
  closeRfq,
  createPurchaseOrderFromRfq,
  sendRfq,
  startRfqComparison,
  submitCounterOffer,
  submitVendorQuote,
} from "@/actions/rfq";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { toast } from "sonner";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Radar,
  RadarChart,
  PolarAngleAxis,
  PolarGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function RfqDetailHub({
  rfq,
  vendors,
}: {
  rfq: RfqDetailDto;
  vendors: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [counterPrice, setCounterPrice] = useState("");
  const [selectedQuote, setSelectedQuote] = useState(rfq.matrix.find((m) => m.isSelected)?.quoteId ?? rfq.matrix[0]?.quoteId ?? "");

  const winner = rfq.matrix[0];
  const lifecycleIdx = RFQ_LIFECYCLE.indexOf(rfq.status);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) => {
    startTransition(async () => {
      const r = await fn();
      if (r.ok) {
        toast.success("Updated");
        router.refresh();
      } else toast.error(r.error ?? "Action failed");
    });
  };

  const priceChart = rfq.matrix.map((q) => ({
    name: q.vendorName.slice(0, 10),
    unit: q.unitPrice,
    total: q.totalPrice,
  }));

  return (
    <div className="space-y-6">
      {rfq.budgetWarning && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900">
          Budget alert: {rfq.budgetWarning}
        </div>
      )}

      <div className="erp-kpi-card flex flex-wrap gap-2 p-4">
        {RFQ_LIFECYCLE.map((s, i) => (
          <div
            key={s}
            className={cn(
              "flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium",
              i <= lifecycleIdx ? RFQ_STATUS_STYLES[s] : "bg-muted/50 text-muted-foreground",
            )}
          >
            {i < lifecycleIdx ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span className="font-mono">{i + 1}</span>}
            {RFQ_STATUS_LABELS[s]}
          </div>
        ))}
      </div>

      {(rfq.status === "SENT" || rfq.status === "QUOTED") && vendors.length > 0 && (
        <form
          className="erp-kpi-card flex flex-wrap items-end gap-3 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            run(() =>
              submitVendorQuote(rfq.id, {
                vendorId: String(fd.get("vendorId")),
                unitPrice: Number(fd.get("unitPrice")),
                deliveryDays: fd.get("deliveryDays") ? Number(fd.get("deliveryDays")) : undefined,
                moq: fd.get("moq") ? Number(fd.get("moq")) : undefined,
                moisturePct: fd.get("moisturePct") ? Number(fd.get("moisturePct")) : undefined,
                pulpYieldPct: fd.get("pulpYieldPct") ? Number(fd.get("pulpYieldPct")) : undefined,
              }),
            );
          }}
        >
          <p className="w-full text-sm font-semibold">Record vendor quote</p>
          <select name="vendorId" required className="h-9 rounded-lg border border-border px-2 text-sm">
            {vendors.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <input name="unitPrice" type="number" required placeholder="Unit ₹" className="h-9 w-24 rounded-lg border px-2 text-sm" />
          <input name="deliveryDays" type="number" placeholder="Days" className="h-9 w-20 rounded-lg border px-2 text-sm" />
          <input name="moisturePct" type="number" step="0.1" placeholder="Moisture %" className="h-9 w-24 rounded-lg border px-2 text-sm" />
          <input name="pulpYieldPct" type="number" step="0.1" placeholder="Pulp %" className="h-9 w-20 rounded-lg border px-2 text-sm" />
          <Button type="submit" size="sm" disabled={pending}>
            Add quote
          </Button>
        </form>
      )}

      <div className="flex flex-wrap gap-2">
        {rfq.status === "DRAFT" && (
          <Button type="button" size="sm" disabled={pending} onClick={() => run(() => sendRfq(rfq.id))}>
            <Send className="mr-1.5 h-4 w-4" />
            Send to vendors
          </Button>
        )}
        {(rfq.status === "SENT" || rfq.status === "QUOTED") && rfq.matrix.length > 0 && (
          <Button type="button" size="sm" disabled={pending} onClick={() => run(() => startRfqComparison(rfq.id))}>
            Start comparison
          </Button>
        )}
        {rfq.status === "COMPARED" && selectedQuote && (
          <Button type="button" size="sm" variant="secondary" disabled={pending} onClick={() => run(() => approveRfqVendor(rfq.id, selectedQuote))}>
            Approve vendor
          </Button>
        )}
        {(rfq.status === "COMPARED" || rfq.status === "APPROVED") && selectedQuote && (
          <Button type="button" size="sm" disabled={pending} onClick={() => run(() => awardRfqVendor(rfq.id, selectedQuote))}>
            <Award className="mr-1.5 h-4 w-4" />
            Award contract
          </Button>
        )}
        {(rfq.status === "AWARDED" || rfq.status === "APPROVED") && !rfq.purchaseId && (
          <Button type="button" size="sm" disabled={pending} onClick={() => run(() => createPurchaseOrderFromRfq(rfq.id))}>
            <FileText className="mr-1.5 h-4 w-4" />
            Generate PO
          </Button>
        )}
        {rfq.purchaseId && (
          <Button type="button" size="sm" variant="outline" asChild>
            <Link href={`/purchases`}>{rfq.purchaseNumber}</Link>
          </Button>
        )}
        {rfq.status === "AWARDED" && (
          <Button type="button" size="sm" variant="ghost" disabled={pending} onClick={() => run(() => closeRfq(rfq.id))}>
            Close RFQ
          </Button>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <Spec label="Sourcing" value={SOURCING_TYPE_LABELS[rfq.sourcingType]} />
        <Spec label="Mode" value={AUCTION_MODE_LABELS[rfq.auctionMode]} />
        <Spec label="Quantity" value={rfq.quantity != null ? `${rfq.quantity} ${rfq.unit}` : "—"} />
        <Spec label="Due" value={rfq.dueDate ? formatDate(new Date(rfq.dueDate)) : "—"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="erp-kpi-card space-y-3 p-5 lg:col-span-2">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-[#B68D40]" strokeWidth={ICON_STROKE} />
            AI supplier recommendation
          </h3>
          <p className="text-lg font-bold">{rfq.aiRecommendedVendorName ?? "—"}</p>
          <p className="text-sm text-muted-foreground">{rfq.aiRecommendationReason}</p>
          {rfq.fpoComparison.fpoSavingsPct != null && (
            <p className="text-xs text-emerald-700">
              FPO avg {rfq.fpoComparison.fpoAvgPrice != null ? formatInr(rfq.fpoComparison.fpoAvgPrice) : "—"} vs commercial{" "}
              {rfq.fpoComparison.commercialAvgPrice != null ? formatInr(rfq.fpoComparison.commercialAvgPrice) : "—"} — save{" "}
              {rfq.fpoComparison.fpoSavingsPct}%
            </p>
          )}
        </div>
        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Seasonal intelligence</h3>
          <p className="mt-2 text-sm text-muted-foreground">{rfq.seasonalInsight}</p>
        </div>
      </div>

      <div className="erp-kpi-card p-5">
        <h3 className="text-sm font-semibold">Food manufacturing specifications</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-5 text-sm">
          <Spec label="Tamarind grade" value={rfq.specTamarindGrade ? TAMARIND_GRADE_LABELS[rfq.specTamarindGrade] : "—"} />
          <Spec label="Moisture max" value={rfq.specMoistureMaxPct != null ? `${rfq.specMoistureMaxPct}%` : "—"} />
          <Spec label="Pulp yield min" value={rfq.specPulpYieldMinPct != null ? `${rfq.specPulpYieldMinPct}%` : "—"} />
          <Spec label="Acidity min" value={rfq.specAcidityMin != null ? `${rfq.specAcidityMin}%` : "—"} />
          <Spec label="MOQ" value={rfq.moqRequired != null ? String(rfq.moqRequired) : "—"} />
        </div>
        {rfq.packagingRequirements && (
          <p className="mt-3 text-xs text-muted-foreground">Packaging: {rfq.packagingRequirements}</p>
        )}
      </div>

      {winner && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="erp-kpi-card flex items-center gap-4 border-[#B68D40]/40 p-5">
          <Trophy className="h-10 w-10 text-[#B68D40]" />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Top ranked vendor</p>
            <p className="text-lg font-bold">{winner.vendorName}</p>
            <p className="text-sm text-muted-foreground">
              Score {winner.compositeScore}/100 · Compliance {winner.complianceScore} · QC pass {winner.qcPassRate}%
            </p>
          </div>
        </motion.div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Price comparison</h3>
          <div className="mt-4 min-h-[220px] w-full">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={priceChart}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                <YAxis tickFormatter={(v) => `₹${v}`} />
                <Tooltip formatter={(v) => formatInr(Number(v))} />
                <Legend />
                <Bar dataKey="unit" fill="#1E3A5F" name="Unit" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        {rfq.matrix.length > 0 && (
          <div className="erp-kpi-card p-5">
            <h3 className="text-sm font-semibold">QC-weighted vendor profile</h3>
            <div className="mt-4 min-h-[220px] w-full">
              <ResponsiveContainer width="100%" height={220}>
                <RadarChart
                  data={[
                    {
                      metric: "Price",
                      ...Object.fromEntries(rfq.matrix.slice(0, 3).map((q) => [q.vendorName.slice(0, 8), 100 - (q.unitPrice / (winner?.unitPrice ?? 1)) * 15])),
                    },
                    {
                      metric: "Compliance",
                      ...Object.fromEntries(rfq.matrix.slice(0, 3).map((q) => [q.vendorName.slice(0, 8), q.complianceScore])),
                    },
                    {
                      metric: "Reliability",
                      ...Object.fromEntries(rfq.matrix.slice(0, 3).map((q) => [q.vendorName.slice(0, 8), q.reliabilityScore])),
                    },
                  ]}
                >
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                  {rfq.matrix.slice(0, 3).map((q, i) => (
                    <Radar
                      key={q.quoteId}
                      name={q.vendorName.slice(0, 8)}
                      dataKey={q.vendorName.slice(0, 8)}
                      stroke={["#B68D40", "#1E3A5F", "#059669"][i]}
                      fill={["#B68D40", "#1E3A5F", "#059669"][i]}
                      fillOpacity={0.12}
                    />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      <div className="erp-table-shell overflow-x-auto rounded-xl border border-border/60">
        <h3 className="border-b px-4 py-3 text-sm font-semibold">Quote comparison matrix</h3>
        <table className="w-full min-w-[1200px] text-left text-sm">
          <thead className="border-b bg-muted/80 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Rank</th>
              <th className="px-3 py-2">Vendor</th>
              <th className="px-3 py-2">Unit</th>
              <th className="px-3 py-2">Total</th>
              <th className="px-3 py-2">Delivery</th>
              <th className="px-3 py-2">MOQ</th>
              <th className="px-3 py-2">Quality</th>
              <th className="px-3 py-2">Compliance</th>
              <th className="px-3 py-2">Reliability</th>
              <th className="px-3 py-2">QC %</th>
              <th className="px-3 py-2">Score</th>
              <th className="px-3 py-2">Select</th>
            </tr>
          </thead>
          <tbody>
            {rfq.matrix.map((q) => (
              <tr key={q.quoteId} className={cn("border-b border-border/40", q.rank === 1 && "bg-[#B68D40]/5")}>
                <td className="px-3 py-3 font-bold">{q.rank}</td>
                <td className="px-3 py-3">
                  <Link href={`/vendors/${q.vendorId}`} className="font-semibold hover:text-[#B68D40]">
                    {q.vendorName}
                  </Link>
                  {q.isFpoPartner && <span className="ml-1 text-[10px] text-emerald-700">FPO</span>}
                  {q.isAiRecommended && <Sparkles className="ml-1 inline h-3 w-3 text-[#B68D40]" />}
                  {q.isSelected && <span className="ml-1 rounded bg-[#B68D40]/15 px-1 text-[10px]">Awarded</span>}
                </td>
                <td className="px-3 py-3">{formatInr(q.unitPrice)}</td>
                <td className="px-3 py-3 font-semibold text-[#B68D40]">{formatInr(q.totalPrice)}</td>
                <td className="px-3 py-3">{q.deliveryDays != null ? `${q.deliveryDays}d` : "—"}</td>
                <td className="px-3 py-3">{q.moq ?? "—"}</td>
                <td className="px-3 py-3">{q.qualityScore}</td>
                <td className="px-3 py-3">{q.complianceScore}</td>
                <td className="px-3 py-3">{q.reliabilityScore}</td>
                <td className="px-3 py-3">{q.qcPassRate}%</td>
                <td className="px-3 py-3">
                  <Star className="mr-0.5 inline h-3.5 w-3.5 text-[#B68D40]" />
                  {q.compositeScore}
                </td>
                <td className="px-3 py-3">
                  <input
                    type="radio"
                    name="award"
                    checked={selectedQuote === q.quoteId}
                    onChange={() => setSelectedQuote(q.quoteId)}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedQuote && (
        <div className="erp-kpi-card flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="text-xs font-medium">Counter-offer (₹/unit)</label>
            <input
              type="number"
              value={counterPrice}
              onChange={(e) => setCounterPrice(e.target.value)}
              className="mt-1 h-9 w-32 rounded-lg border border-border px-2 text-sm"
            />
          </div>
          <Button
            type="button"
            size="sm"
            variant="secondary"
            disabled={pending || !counterPrice}
            onClick={() =>
              run(() => submitCounterOffer(selectedQuote, Number(counterPrice)))
            }
          >
            <Gavel className="mr-1 h-4 w-4" />
            Send counter-offer
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Timeline</h3>
          <ul className="mt-4 space-y-3">
            {rfq.timeline.length === 0 ? (
              <li className="text-sm text-muted-foreground">No events yet</li>
            ) : (
              rfq.timeline.map((e) => (
                <li key={e.id} className="border-l-2 border-[#B68D40]/40 pl-3">
                  <p className="text-sm font-medium">{e.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDate(new Date(e.createdAt))}
                    {e.vendorName ? ` · ${e.vendorName}` : ""}
                  </p>
                  {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
                </li>
              ))
            )}
          </ul>
        </div>
        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Negotiations</h3>
          <ul className="mt-4 space-y-2">
            {rfq.negotiations.length === 0 ? (
              <li className="text-sm text-muted-foreground">No counter-offers yet</li>
            ) : (
              rfq.negotiations.map((n) => (
                <li key={n.id} className="rounded-lg bg-muted/40 px-3 py-2 text-sm">
                  <span className="font-medium">{n.vendorName}</span> — Round {n.round} ({n.offeredBy}): {formatInr(n.unitPrice)}
                  {n.notes && <span className="block text-xs text-muted-foreground">{n.notes}</span>}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>

      {rfq.notes && (
        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Notes</h3>
          <p className="mt-2 text-sm text-muted-foreground">{rfq.notes}</p>
        </div>
      )}
    </div>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}
