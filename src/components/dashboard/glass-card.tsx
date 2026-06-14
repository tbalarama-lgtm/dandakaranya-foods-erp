"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type GlassCardProps = {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  hoverLift?: boolean;
  glow?: "emerald" | "blue" | "violet" | "amber" | "none";
};

const glowMap = {
  emerald: "group-hover:shadow-[0_8px_40px_-12px_hsl(158_40%_38%_/_0.45)]",
  blue: "group-hover:shadow-[0_8px_40px_-12px_hsl(220_70%_50%_/_0.4)]",
  violet: "group-hover:shadow-[0_8px_40px_-12px_hsl(260_60%_55%_/_0.4)]",
  amber: "group-hover:shadow-[0_8px_40px_-12px_hsl(38_55%_52%_/_0.4)]",
  none: "",
};

export function GlassCard({
  children,
  className,
  delay = 0,
  hoverLift = true,
  glow = "none",
}: GlassCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={
        hoverLift
          ? { y: -4, transition: { duration: 0.25, ease: "easeOut" } }
          : undefined
      }
      className={cn(
        "glass-card group relative overflow-hidden rounded-2xl border-border/70 transition-shadow duration-300",
        glowMap[glow],
        className,
      )}
    >
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/50 via-white/10 to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100 dark:from-white/10 dark:via-white/5"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-primary/10 blur-2xl transition-all duration-500 group-hover:bg-primary/20"
        aria-hidden
      />
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

export function GlassCardHeader({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("border-b border-white/20 px-5 py-4 dark:border-white/10", className)}>
      {children}
    </div>
  );
}

export function GlassCardBody({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn("p-5", className)}>{children}</div>;
}
