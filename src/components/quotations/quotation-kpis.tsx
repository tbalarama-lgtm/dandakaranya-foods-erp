"use client";

import { motion } from "framer-motion";
import type { QuotationAnalytics } from "@/lib/quotation-types";
import { formatInr } from "@/lib/utils";

export function QuotationKpis({ analytics }: { analytics: QuotationAnalytics }) {
  const kpis = [
    { label: "Total quotes", value: String(analytics.totalQuotes) },
    { label: "Open quotes", value: String(analytics.openQuotes) },
    { label: "Conversion rate", value: `${analytics.conversionRate}%`, highlight: true },
    { label: "Lost / expired", value: String(analytics.lostQuotes), warn: analytics.lostQuotes > 0 },
    { label: "Avg negotiation", value: analytics.avgNegotiationDays ? `${analytics.avgNegotiationDays}d` : "—" },
    { label: "Revenue forecast", value: formatInr(analytics.forecastValue), highlight: true },
    { label: "Expiring soon", value: String(analytics.expiringSoon), warn: analytics.expiringSoon > 0 },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
      {kpis.map((k, i) => (
        <motion.div
          key={k.label}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          className="erp-kpi-card p-4"
        >
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{k.label}</p>
          <p className={`mt-1 text-lg font-semibold ${k.warn ? "text-amber-600" : k.highlight ? "text-[#B68D40]" : ""}`}>
            {k.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
