"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowUpDown,
  Clock,
  Eye,
  Gavel,
  Percent,
  Plus,
  Search,
  Sparkles,
  TrendingDown,
  Users,
} from "lucide-react";
import type { RFQStatus } from "@prisma/client";
import type { RfqAnalytics, RfqListRow, RfqSourcingKpis } from "@/lib/rfq-types";
import { RFQ_STATUS_LABELS, RFQ_STATUS_STYLES, SOURCING_TYPE_LABELS } from "@/lib/rfq-types";
import { Button } from "@/components/ui/button";
import { formatDate, formatInr, cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export function RfqSourcingHub({
  rfqs,
  kpis,
  analytics,
}: {
  rfqs: RfqListRow[];
  kpis: RfqSourcingKpis;
  analytics: RfqAnalytics;
}) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<RFQStatus | "">("");
  const [sortKey, setSortKey] = useState<"date" | "quotes" | "lowest">("date");

  const filtered = useMemo(() => {
    let rows = [...rfqs];
    if (q.trim()) {
      const s = q.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.title.toLowerCase().includes(s) ||
          r.rfqNumber.toLowerCase().includes(s) ||
          (r.productName?.toLowerCase().includes(s) ?? false),
      );
    }
    if (status) rows = rows.filter((r) => r.status === status);
    rows.sort((a, b) => {
      if (sortKey === "quotes") return b.quoteCount - a.quoteCount;
      if (sortKey === "lowest") return (a.lowestQuote ?? 0) - (b.lowestQuote ?? 0);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    return rows;
  }, [rfqs, q, status, sortKey]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard icon={Gavel} label="Active RFQs" value={String(kpis.activeRfqs)} sub={`${kpis.totalRfqs} total`} />
        <KpiCard icon={TrendingDown} label="Procurement savings" value={`${kpis.procurementSavingsPct}%`} sub="vs baseline" />
        <KpiCard icon={Clock} label="Avg response" value={`${kpis.avgResponseHours}h`} sub={`${kpis.avgNegotiationDays}d negotiation`} />
        <KpiCard icon={Percent} label="Conversion rate" value={`${kpis.conversionRatePct}%`} sub={`${kpis.awardedThisMonth} awarded MTD`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="erp-kpi-card p-5 lg:col-span-2">
          <h3 className="text-sm font-semibold">Vendor response time (hours)</h3>
          <div className="mt-4 min-h-[180px] w-full">
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={analytics.responseTrend}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="hours" fill="#1E3A5F" radius={[4, 4, 0, 0]} name="Hours" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">RFQ status mix</h3>
          <ul className="mt-4 space-y-2">
            {analytics.statusDistribution
              .filter((s) => s.count > 0)
              .map((s) => (
                <li key={s.status} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {RFQ_STATUS_LABELS[s.status as RFQStatus] ?? s.status}
                  </span>
                  <span className="font-semibold">{s.count}</span>
                </li>
              ))}
          </ul>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex flex-1 flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              type="search"
              placeholder="Search RFQ #, title, product…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-3 text-sm"
            />
          </div>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as RFQStatus | "")}
            className="h-10 rounded-xl border border-border bg-background px-3 text-sm"
          >
            <option value="">All statuses</option>
            {Object.entries(RFQ_STATUS_LABELS).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </div>
        <Button type="button" size="sm" asChild>
          <Link href="/procurement/rfq/new">
            <Plus className="mr-1.5 h-4 w-4" />
            New RFQ
          </Link>
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {filtered.length} RFQ(s) · {kpis.pendingComparison} awaiting comparison
      </p>

      <div className="erp-table-shell overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[1100px] text-left text-sm">
          <thead className="sticky top-0 z-10 border-b border-border/60 bg-muted/80 text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-semibold">RFQ #</th>
              <th className="px-4 py-3 font-semibold">Title</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Sourcing</th>
              <th className="px-4 py-3 font-semibold">Product</th>
              <SortTh label="Quotes" k="quotes" active={sortKey} onSort={setSortKey} />
              <SortTh label="Lowest" k="lowest" active={sortKey} onSort={setSortKey} />
              <th className="px-4 py-3 font-semibold">Budget</th>
              <th className="px-4 py-3 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {filtered.map((r) => (
              <tr key={r.id} className="erp-table-row">
                <td className="px-4 py-3.5 font-mono text-xs">{r.rfqNumber}</td>
                <td className="px-4 py-3.5 font-semibold">{r.title}</td>
                <td className="px-4 py-3.5">
                  <span className={cn("rounded-md px-2 py-0.5 text-[11px] font-semibold", RFQ_STATUS_STYLES[r.status])}>
                    {RFQ_STATUS_LABELS[r.status]}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-xs">
                  {SOURCING_TYPE_LABELS[r.sourcingType]}
                  {r.auctionMode === "REVERSE_AUCTION" && (
                    <span className="ml-1 rounded bg-violet-500/15 px-1 text-violet-700">Auction</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-muted-foreground">
                  {r.productName ?? "—"}
                  {r.quantity != null && ` · ${r.quantity} ${r.unit ?? "kg"}`}
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {r.quoteCount}
                  </span>
                </td>
                <td className="px-4 py-3.5 font-semibold text-[#B68D40]">
                  {r.lowestQuote != null ? formatInr(r.lowestQuote) : "—"}
                </td>
                <td className="px-4 py-3.5 text-xs">
                  {r.budgetAmount != null ? formatInr(r.budgetAmount) : "—"}
                  {r.budgetOverPct != null && (
                    <span className="ml-1 text-red-600">+{r.budgetOverPct}%</span>
                  )}
                </td>
                <td className="px-4 py-3.5 text-right">
                  <Button type="button" size="sm" variant="ghost" asChild>
                    <Link href={`/procurement/rfq/${r.id}`}>
                      <Eye className="mr-1 h-4 w-4" />
                      Open
                    </Link>
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub: string;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="erp-kpi-card p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-[#B68D40]/12 p-2">
          <Icon className="h-4 w-4 text-[#B68D40]" strokeWidth={ICON_STROKE} />
        </div>
        <div>
          <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-xl font-bold">{value}</p>
          <p className="text-xs text-muted-foreground">{sub}</p>
        </div>
      </div>
    </motion.div>
  );
}

function SortTh({
  label,
  k,
  active,
  onSort,
}: {
  label: string;
  k: "date" | "quotes" | "lowest";
  active: string;
  onSort: (k: "date" | "quotes" | "lowest") => void;
}) {
  return (
    <th className="px-4 py-3 font-semibold">
      <button type="button" className="inline-flex items-center gap-1 hover:text-foreground" onClick={() => onSort(k)}>
        {label}
        <ArrowUpDown className={cn("h-3 w-3", active === k && "text-[#B68D40]")} />
      </button>
    </th>
  );
}
