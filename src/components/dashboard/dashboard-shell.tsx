"use client";

import { motion } from "framer-motion";

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="dashboard-canvas relative min-h-[calc(100vh-8rem)]">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <motion.div
          className="absolute -left-24 top-0 h-[420px] w-[420px] rounded-full bg-gradient-to-br from-primary/25 to-emerald-400/10 blur-3xl"
          animate={{ x: [0, 40, 0], y: [0, 25, 0], scale: [1, 1.05, 1] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -right-16 top-32 h-[360px] w-[360px] rounded-full bg-gradient-to-bl from-blue-500/20 to-violet-500/10 blur-3xl"
          animate={{ x: [0, -30, 0], y: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        />
        <motion.div
          className="absolute bottom-0 left-1/3 h-[280px] w-[480px] -translate-x-1/2 rounded-full bg-gradient-to-t from-amber-500/15 to-transparent blur-3xl"
          animate={{ opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.3)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.3)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_80%_60%_at_50%_0%,#000_20%,transparent_70%)]" />
      </div>
      <div className="relative z-10 space-y-8">{children}</div>
    </div>
  );
}
