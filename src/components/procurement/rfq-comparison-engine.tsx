"use client";

import Link from "next/link";
import type { RfqComparisonQuote } from "@/lib/procurement-types";
import { TAMARIND_GRADE_LABELS } from "@/lib/vendor-types";
import { formatInr } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Star, Trophy } from "lucide-react";
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

export function RfqComparisonEngine({ quotes }: { quotes: RfqComparisonQuote[] }) {
  if (quotes.length === 0) {
    return <p className="text-sm text-muted-foreground">No vendor quotes received for this RFQ yet.</p>;
  }

  const winner = quotes[0];
  const priceChart = quotes.map((q) => ({
    name: q.vendorName.slice(0, 12),
    unitPrice: q.unitPrice,
    total: q.totalPrice,
  }));

  const radarData = [
    { metric: "Price", ...Object.fromEntries(quotes.map((q) => [q.vendorName.slice(0, 8), 100 - (q.unitPrice / winner.unitPrice) * 20])) },
    { metric: "Quality", ...Object.fromEntries(quotes.map((q) => [q.vendorName.slice(0, 8), q.qualityScore ?? 85])) },
    { metric: "Delivery", ...Object.fromEntries(quotes.map((q) => [q.vendorName.slice(0, 8), q.reliabilityScore ?? 88])) },
    { metric: "Composite", ...Object.fromEntries(quotes.map((q) => [q.vendorName.slice(0, 8), q.compositeScore])) },
  ];

  return (
    <div className="space-y-6">
      <div className="erp-kpi-card flex items-center gap-4 border-[#B68D40]/40 p-5">
        <Trophy className="h-10 w-10 text-[#B68D40]" />
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Automated recommendation</p>
          <p className="text-lg font-bold">{winner.vendorName}</p>
          <p className="text-sm text-muted-foreground">{winner.recommendation} · Score {winner.compositeScore}/100</p>
        </div>
      </div>

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
                <Bar dataKey="unitPrice" fill="#1E3A5F" name="Unit price" radius={[4, 4, 0, 0]} />
                <Bar dataKey="total" fill="#B68D40" name="Total" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="erp-kpi-card p-5">
          <h3 className="text-sm font-semibold">Vendor score profile</h3>
          <div className="mt-4 min-h-[220px] w-full">
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="metric" tick={{ fontSize: 10 }} />
                {quotes.slice(0, 3).map((q, i) => (
                  <Radar
                    key={q.quoteId}
                    name={q.vendorName.slice(0, 8)}
                    dataKey={q.vendorName.slice(0, 8)}
                    stroke={["#B68D40", "#1E3A5F", "#059669"][i]}
                    fill={["#B68D40", "#1E3A5F", "#059669"][i]}
                    fillOpacity={0.15}
                  />
                ))}
                <Legend />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div className="erp-table-shell overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full min-w-[1000px] text-left text-sm">
          <thead className="border-b bg-muted/80 text-[11px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Rank</th>
              <th className="px-4 py-3">Vendor</th>
              <th className="px-4 py-3">Unit price</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Delivery</th>
              <th className="px-4 py-3">Moisture</th>
              <th className="px-4 py-3">Tamarind grade</th>
              <th className="px-4 py-3">Score</th>
              <th className="px-4 py-3">Analysis</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr
                key={q.quoteId}
                className={cn("border-b border-border/40", q.rank === 1 && "bg-[#B68D40]/5")}
              >
                <td className="px-4 py-3.5 font-bold">{q.rank}</td>
                <td className="px-4 py-3.5">
                  <Link href={`/vendors/${q.vendorId}`} className="font-semibold hover:text-[#B68D40]">
                    {q.vendorName}
                  </Link>
                  {q.isSelected && (
                    <span className="ml-2 rounded-md bg-[#B68D40]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#967235]">
                      Awarded
                    </span>
                  )}
                </td>
                <td className="px-4 py-3.5">{formatInr(q.unitPrice)}</td>
                <td className="px-4 py-3.5 font-semibold text-[#B68D40]">{formatInr(q.totalPrice)}</td>
                <td className="px-4 py-3.5">{q.deliveryDays != null ? `${q.deliveryDays}d` : "—"}</td>
                <td className="px-4 py-3.5">{q.moisturePct != null ? `${q.moisturePct}%` : "—"}</td>
                <td className="px-4 py-3.5 text-xs">
                  {q.tamarindGrade ? TAMARIND_GRADE_LABELS[q.tamarindGrade] : "—"}
                </td>
                <td className="px-4 py-3.5">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <Star className="h-3.5 w-3.5 text-[#B68D40]" />
                    {q.compositeScore}
                  </span>
                </td>
                <td className="px-4 py-3.5 text-xs text-muted-foreground">{q.recommendation}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
