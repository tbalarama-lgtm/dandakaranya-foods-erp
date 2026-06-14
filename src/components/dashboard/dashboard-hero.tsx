"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Plus, Sparkles, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExportStatsButton } from "@/components/dashboard/export-stats-button";

export function DashboardHero({ userName }: { userName: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-card glass-hero relative overflow-hidden rounded-2xl p-6 md:p-8"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-r from-primary/10 via-transparent to-blue-500/10"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 -top-20 h-56 w-56 rounded-full bg-primary/20 blur-3xl"
        aria-hidden
      />
      <motion.div
        initial={{ opacity: 0, x: -12 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <motion.p
            className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-primary"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <Sparkles className="h-3.5 w-3.5" />
            Enterprise ERP
          </motion.p>
          <motion.h1
            className="mt-2 bg-gradient-to-r from-foreground via-foreground to-primary bg-clip-text text-2xl font-semibold tracking-tight text-transparent md:text-3xl"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15, duration: 0.5 }}
          >
            Welcome back, {userName}
          </motion.h1>
          <motion.p
            className="mt-2 max-w-xl text-sm text-muted-foreground"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.25 }}
          >
            Real-time command center for sales, inventory, production, CRM, finance, and HR.
          </motion.p>
        </div>
        <motion.div
          className="flex flex-wrap gap-2"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <ExportStatsButton />
          <Button asChild size="sm" variant="premium">
            <Link href="/sales/new">
              <Plus className="h-4 w-4" strokeWidth={1.75} />
              New invoice
            </Link>
          </Button>
          <Button asChild variant="secondary" size="sm" className="glass-button">
            <Link href="/purchases/new">
              <Truck className="h-4 w-4" />
              Record purchase
            </Link>
          </Button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}
