"use client";

import { motion } from "framer-motion";
import type { CustomerAnalytics } from "@/lib/customer-types";
import { formatInr } from "@/lib/utils";

export function CustomerKpis({ analytics }: { analytics: CustomerAnalytics }) {
  const kpis = [
    { label: "Total customers", value: String(analytics.totalCustomers) },
    { label: "Active", value: String(analytics.activeCustomers) },
    { label: "High value", value: String(analytics.highValueCount), highlight: true },
    { label: "Outstanding", value: formatInr(analytics.totalOutstanding), warn: analytics.totalOutstanding > 0 },
    { label: "Overdue invoices", value: String(analytics.overdueInvoices), warn: analytics.overdueInvoices > 0 },
    { label: "Avg LTV", value: formatInr(analytics.avgLifetimeValue) },
    { label: "Repeat rate", value: `${analytics.repeatRate}%` },
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
          <p
            className={`mt-1 text-lg font-semibold ${k.warn ? "text-amber-600" : k.highlight ? "text-[#B68D40]" : ""}`}
          >
            {k.value}
          </p>
        </motion.div>
      ))}
    </div>
  );
}
