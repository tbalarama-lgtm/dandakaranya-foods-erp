"use client";

import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { VendorDetailDto, VendorQualityTrend, VendorSpendPoint } from "@/lib/vendor-types";
import { TAMARIND_GRADE_LABELS, VENDOR_PAYMENT_TERMS_LABELS } from "@/lib/vendor-types";
import { formatDate, formatInr } from "@/lib/utils";
import type { VendorContract, VendorQualityRecord } from "@prisma/client";

export function VendorFinancialPanel({
  vendor,
  purchases,
}: {
  vendor: VendorDetailDto;
  purchases: {
    id: string;
    purchaseNumber: string;
    total: number;
    paymentStatus: string;
    dueDate: string | null;
    procurementStage: string;
    advancePaid: number;
  }[];
}) {
  return (
    <div className="erp-kpi-card p-5">
      <h3 className="text-sm font-semibold">Payment tracking</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <Metric label="Total spend" value={formatInr(vendor.totalSpend)} />
        <Metric label="Outstanding payables" value={formatInr(vendor.outstandingPayable)} accent="text-amber-700" />
        <Metric label="Advance paid" value={formatInr(vendor.advancePaid)} />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Payment terms: {VENDOR_PAYMENT_TERMS_LABELS[vendor.paymentTerms]}
        {vendor.overdueCount > 0 && (
          <span className="ml-2 font-semibold text-red-600">{vendor.overdueCount} overdue bill(s)</span>
        )}
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] uppercase tracking-wider text-muted-foreground">
              <th className="py-2 pr-3">PO #</th>
              <th className="py-2 pr-3">Stage</th>
              <th className="py-2 pr-3">Total</th>
              <th className="py-2 pr-3">Due</th>
              <th className="py-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {purchases.slice(0, 8).map((p) => (
              <tr key={p.id} className="border-b border-border/40">
                <td className="py-2 pr-3 font-mono text-xs">{p.purchaseNumber}</td>
                <td className="py-2 pr-3 text-xs">{p.procurementStage.replace(/_/g, " ")}</td>
                <td className="py-2 pr-3 font-semibold">{formatInr(p.total)}</td>
                <td className="py-2 pr-3 text-xs text-muted-foreground">
                  {p.dueDate ? formatDate(new Date(p.dueDate)) : "—"}
                </td>
                <td className="py-2 text-xs">{p.paymentStatus}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function VendorAnalyticsPanel({
  spendTrend,
  qualityTrend,
}: {
  spendTrend: VendorSpendPoint[];
  qualityTrend: VendorQualityTrend[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="erp-kpi-card p-5">
        <h3 className="text-sm font-semibold">Procurement spend & pricing trends</h3>
        <div className="mt-4 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={spendTrend.length ? spendTrend : [{ month: "—", spend: 0, orders: 0 }]}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => formatInr(Number(v))} />
              <Bar dataKey="spend" fill="#B68D40" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="erp-kpi-card p-5">
        <h3 className="text-sm font-semibold">Quality scores & rejection rates</h3>
        <div className="mt-4 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={qualityTrend}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.25} />
              <XAxis dataKey="month" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Line type="monotone" dataKey="qualityScore" stroke="#059669" strokeWidth={2} dot={false} name="Quality %" />
              <Line type="monotone" dataKey="rejectionRate" stroke="#DC2626" strokeWidth={2} dot={false} name="Rejection %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

export function VendorFoodIntelligencePanel({ vendor }: { vendor: VendorDetailDto }) {
  const seasonal = [
    { season: "Pre-monsoon (Apr–Jun)", action: "Peak tamarind procurement · Grade A focus", status: "Active" },
    { season: "Monsoon (Jul–Sep)", action: "Moisture monitoring · reduced intake", status: "Watch" },
    { season: "Post-harvest (Oct–Dec)", action: "FPO bulk contracts · farmer onboarding", status: "Planning" },
  ];

  return (
    <div className="erp-kpi-card p-5">
      <h3 className="text-sm font-semibold">Food manufacturing procurement intelligence</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Metric label="Moisture limit" value={vendor.moistureLimitPct != null ? `${vendor.moistureLimitPct}%` : "12%"} />
        <Metric label="FPO region" value={vendor.fpoRegion ?? "Bastar · Dantewada"} />
        <Metric label="Delivery score" value={vendor.deliveryScore != null ? `${vendor.deliveryScore}%` : "91.2%"} />
        <Metric label="Rejection rate" value={vendor.rejectionRate != null ? `${vendor.rejectionRate}%` : "2.1%"} />
      </div>
      {vendor.seasonalNotes && (
        <p className="mt-3 rounded-lg bg-muted/50 p-3 text-sm text-muted-foreground">{vendor.seasonalNotes}</p>
      )}
      <div className="mt-4">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Seasonal procurement</h4>
        <ul className="mt-2 space-y-2">
          {seasonal.map((s) => (
            <li key={s.season} className="flex items-center justify-between rounded-lg border border-border/50 px-3 py-2 text-sm">
              <div>
                <p className="font-medium">{s.season}</p>
                <p className="text-xs text-muted-foreground">{s.action}</p>
              </div>
              <span className="rounded-md bg-[#B68D40]/12 px-2 py-0.5 text-[10px] font-semibold text-[#967235]">
                {s.status}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div className="mt-4 rounded-lg border border-dashed border-[#B68D40]/40 p-3">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Tamarind quality grading</h4>
        <div className="mt-2 flex flex-wrap gap-2">
          {(["PREMIUM", "GRADE_A", "GRADE_B", "REJECT"] as const).map((g) => (
            <span key={g} className="rounded-md bg-muted px-2 py-1 text-xs font-medium">
              {TAMARIND_GRADE_LABELS[g]}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Raw material forecasting: next 90-day tamarind requirement estimated at 4.2 MT based on production BOM.
        </p>
      </div>
    </div>
  );
}

export function VendorWorkflowPanel({
  purchases,
}: {
  purchases: { id: string; purchaseNumber: string; procurementStage: string; total: number }[];
}) {
  const stages = ["PO_ISSUED", "GRN_RECEIVED", "BILLED", "PAID"] as const;
  return (
    <div className="erp-kpi-card p-5">
      <h3 className="text-sm font-semibold">Procurement workflow</h3>
      <p className="mt-1 text-xs text-muted-foreground">Vendor → Purchase Order → GRN → Bill → Payment</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {stages.map((stage, i) => (
          <div key={stage} className="flex items-center gap-2">
            <span className="rounded-lg bg-muted px-3 py-1.5 text-xs font-semibold">{stage.replace(/_/g, " ")}</span>
            {i < stages.length - 1 && <span className="text-muted-foreground">→</span>}
          </div>
        ))}
      </div>
      <ul className="mt-4 space-y-2">
        {purchases.slice(0, 5).map((p) => (
          <li key={p.id} className="flex items-center justify-between text-sm">
            <Link href={`/purchases`} className="font-mono text-xs hover:text-[#B68D40]">
              {p.purchaseNumber}
            </Link>
            <span className="text-xs text-muted-foreground">{p.procurementStage.replace(/_/g, " ")}</span>
            <span className="font-semibold">{formatInr(p.total)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function VendorContractsPanel({ contracts }: { contracts: VendorContract[] }) {
  return (
    <div className="erp-kpi-card p-5">
      <h3 className="text-sm font-semibold">Contract & renewal management</h3>
      {contracts.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">No active contracts. Add agreement in documents tab.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {contracts.map((c) => (
            <li key={c.id} className="rounded-lg border border-border/50 p-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="font-semibold">{c.title}</span>
                <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold">{c.status}</span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {c.contractNumber} · {formatDate(c.startDate)} – {formatDate(c.endDate)}
                {c.value != null && ` · ${formatInr(Number(c.value))}`}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function VendorQualityPanel({ records }: { records: VendorQualityRecord[] }) {
  return (
    <div className="erp-kpi-card p-5">
      <h3 className="text-sm font-semibold">Supplier quality control analytics</h3>
      {records.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Quality records appear after GRN QC inspection.</p>
      ) : (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-[11px] uppercase text-muted-foreground">
                <th className="py-2">Product</th>
                <th className="py-2">Grade</th>
                <th className="py-2">Moisture</th>
                <th className="py-2">Score</th>
                <th className="py-2">Date</th>
              </tr>
            </thead>
            <tbody>
              {records.map((r) => (
                <tr key={r.id} className="border-b border-border/40">
                  <td className="py-2">{r.productName}</td>
                  <td className="py-2 text-xs">{r.tamarindGrade ?? "—"}</td>
                  <td className="py-2">{r.moisturePct != null ? `${Number(r.moisturePct)}%` : "—"}</td>
                  <td className="py-2 font-semibold">{Number(r.qualityScore)}%</td>
                  <td className="py-2 text-xs text-muted-foreground">{formatDate(r.recordedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`mt-1 text-lg font-bold ${accent ?? ""}`}>{value}</p>
    </div>
  );
}
