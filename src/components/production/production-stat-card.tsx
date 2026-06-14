"use client";

import { motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductionStatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "emerald",
  delay = 0,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: LucideIcon;
  accent?: "emerald" | "blue" | "amber" | "rose" | "violet";
  delay?: number;
}) {
  const accents = {
    emerald: "from-emerald-500/20 to-emerald-600/5 text-emerald-600 dark:text-emerald-400",
    blue: "from-blue-500/20 to-blue-600/5 text-blue-600 dark:text-blue-400",
    amber: "from-amber-500/20 to-amber-600/5 text-amber-600 dark:text-amber-400",
    rose: "from-rose-500/20 to-rose-600/5 text-rose-600 dark:text-rose-400",
    violet: "from-violet-500/20 to-violet-600/5 text-violet-600 dark:text-violet-400",
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.35 }}
      whileHover={{ y: -2 }}
      className="glass-card rounded-2xl p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="mt-1 text-xl font-semibold">{value}</p>
          {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br", accents[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </motion.div>
  );
}
