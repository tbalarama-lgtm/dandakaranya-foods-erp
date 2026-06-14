"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export type KpiItem = {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  accent?: "gold" | "emerald" | "blue" | "violet" | "rose";
  trend?: string;
};

const accentStyles = {
  gold: {
    icon: "bg-[#B68D40]/12 text-[#B68D40] ring-[#B68D40]/25",
    bar: "from-[#B68D40]/60 to-[#967235]/40",
  },
  emerald: {
    icon: "bg-emerald-500/12 text-emerald-600 ring-emerald-500/20 dark:text-emerald-400",
    bar: "from-emerald-400/50 to-emerald-600/30",
  },
  blue: {
    icon: "bg-blue-500/12 text-blue-600 ring-blue-500/20 dark:text-blue-400",
    bar: "from-blue-400/50 to-blue-600/30",
  },
  violet: {
    icon: "bg-violet-500/12 text-violet-600 ring-violet-500/20 dark:text-violet-400",
    bar: "from-violet-400/50 to-violet-600/30",
  },
  rose: {
    icon: "bg-rose-500/12 text-rose-600 ring-rose-500/20 dark:text-rose-400",
    bar: "from-rose-400/50 to-rose-600/30",
  },
};

export function KpiStatRow({ items, className }: { items: KpiItem[]; className?: string }) {
  return (
    <div className={cn("grid gap-4 sm:grid-cols-2 xl:grid-cols-4", className)}>
      {items.map((item, i) => {
        const accent = accentStyles[item.accent ?? "gold"];
        const Icon = item.icon;

        return (
          <motion.div
            key={item.label}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
            whileHover={{ y: -3, transition: { duration: 0.2 } }}
            className="erp-kpi-card group relative overflow-hidden"
          >
            <div
              className={cn(
                "absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r opacity-80 transition-opacity group-hover:opacity-100",
                accent.bar,
              )}
            />
            <div className="flex items-start justify-between gap-3 p-5">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                  {item.label}
                </p>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{item.value}</p>
                {(item.sub || item.trend) && (
                  <p className="mt-1 text-xs text-muted-foreground">{item.trend ?? item.sub}</p>
                )}
              </div>
              <div
                className={cn(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 transition-transform duration-200 group-hover:scale-105",
                  accent.icon,
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={ICON_STROKE} />
              </div>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
