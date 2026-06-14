"use client";

import { motion } from "framer-motion";
import {
  BarChart3,
  Boxes,
  Factory,
  Landmark,
  MessageSquare,
  Package,
  ShoppingCart,
  Truck,
  Warehouse,
} from "lucide-react";
import { BrandLogoImage } from "@/components/brand/brand-logo-image";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { cn } from "@/lib/utils";

const MODULES = [
  { label: "Sales", icon: ShoppingCart },
  { label: "Inventory", icon: Warehouse },
  { label: "Procurement", icon: Truck },
  { label: "CRM", icon: MessageSquare },
  { label: "Finance", icon: Landmark },
];

const SUPPLY_CHAIN = [
  { label: "Source", icon: Factory },
  { label: "Procure", icon: Truck },
  { label: "Store", icon: Warehouse },
  { label: "Produce", icon: Package },
  { label: "Deliver", icon: Boxes },
];

export function LoginHeroPanel() {
  return (
    <div className="login-hero relative flex h-full flex-col justify-between overflow-hidden p-8 text-[#E5E7EB] xl:p-12">
      <div className="pointer-events-none absolute inset-0 login-hero-grid" aria-hidden />
      <div className="pointer-events-none absolute -left-20 top-20 h-72 w-72 rounded-full bg-[#B68D40]/10 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute bottom-10 right-0 h-64 w-64 rounded-full bg-[#102544]/80 blur-3xl" aria-hidden />

      <div className="relative z-10">
        <div className="flex items-center gap-3">
          <BrandLogoImage size={52} priority className="login-hero-logo ring-2 ring-[#B68D40]/30" />
          <div>
            <p className="text-lg font-bold tracking-tight">Dandakaranya Foods</p>
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-[#94A3B8]">
              Enterprise Resource Planning
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="mt-10 max-w-lg"
        >
          <h1 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
            Unified operations for{" "}
            <span className="bg-gradient-to-r from-[#B68D40] to-[#C9A55A] bg-clip-text text-transparent">
              agri-food excellence
            </span>
          </h1>
          <p className="mt-4 text-base leading-relaxed text-[#94A3B8]">
            Manage sales, inventory, procurement, production, and finance from one secure enterprise console —
            built for Dandakaranya&apos;s tamarind and specialty foods business.
          </p>
        </motion.div>

        {/* Supply chain animation */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="mt-10 hidden lg:block"
        >
          <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
            End-to-end supply chain
          </p>
          <div className="flex items-center gap-1">
            {SUPPLY_CHAIN.map((step, i) => {
              const Icon = step.icon;
              return (
                <div key={step.label} className="flex flex-1 items-center">
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.4 + i * 0.1 }}
                    whileHover={{ y: -2 }}
                    className="login-hero-chip flex flex-1 flex-col items-center gap-2 rounded-xl px-2 py-3"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#B68D40]/15 text-[#B68D40]">
                      <Icon className="h-5 w-5" strokeWidth={ICON_STROKE} />
                    </div>
                    <span className="text-[10px] font-medium text-[#94A3B8]">{step.label}</span>
                  </motion.div>
                  {i < SUPPLY_CHAIN.length - 1 && (
                    <motion.div
                      className="mx-0.5 h-px flex-1 max-w-[24px] bg-gradient-to-r from-[#B68D40]/50 to-[#B68D40]/10"
                      animate={{ opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Dashboard preview mock */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.55 }}
          className="login-dashboard-preview mt-10 hidden xl:block"
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#94A3B8]">
              Live dashboard preview
            </p>
            <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
              System online
            </span>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-[#08182F]/80 p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.5)] backdrop-blur-xl">
            <div className="mb-3 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-[#B68D40]" strokeWidth={ICON_STROKE} />
              <span className="text-xs font-medium text-[#E5E7EB]">Operations overview</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {[72, 48, 86].map((h, i) => (
                <motion.div
                  key={i}
                  className="rounded-lg bg-[#102544]/80 p-2"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 3, repeat: Infinity, delay: i * 0.4 }}
                >
                  <div className="mb-2 h-1.5 w-8 rounded bg-[#B68D40]/40" />
                  <div className="flex h-12 items-end gap-0.5">
                    {[40, 65, h, 55, 90, 70].map((bar, j) => (
                      <div
                        key={j}
                        className="flex-1 rounded-sm bg-gradient-to-t from-[#B68D40]/80 to-[#B68D40]/30"
                        style={{ height: `${bar * 0.45}%` }}
                      />
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Module highlights */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.65, duration: 0.5 }}
          className="mt-8 flex flex-wrap gap-2"
        >
          {MODULES.map((mod, i) => {
            const Icon = mod.icon;
            return (
              <motion.span
                key={mod.label}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.7 + i * 0.06 }}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs font-medium text-[#94A3B8]",
                )}
              >
                <Icon className="h-3.5 w-3.5 text-[#B68D40]" strokeWidth={ICON_STROKE} />
                {mod.label}
              </motion.span>
            );
          })}
        </motion.div>
      </div>

      <p className="relative z-10 hidden text-xs text-[#94A3B8]/80 lg:block">
        Trusted by operations teams across Sukma, Raipur &amp; national distribution.
      </p>
    </div>
  );
}
