"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { FileText, Plus, Truck, UserPlus, X, Zap } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { cn } from "@/lib/utils";

const ACTIONS = [
  { href: "/sales/new", label: "New invoice", icon: FileText },
  { href: "/purchases/new", label: "Record purchase", icon: Truck },
  { href: "/leads", label: "Add lead", icon: UserPlus },
  { href: "/inventory", label: "Stock check", icon: Zap },
] as const;

export function QuickActionsFab() {
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed bottom-6 right-6 z-40 lg:bottom-8 lg:right-8">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.95 }}
            className="mb-3 overflow-hidden rounded-2xl border border-border/70 bg-card/95 p-2 shadow-erp-xl backdrop-blur-xl"
          >
            {ACTIONS.map((a, i) => {
              const Icon = a.icon;
              return (
                <motion.div
                  key={a.href}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Link
                    href={a.href}
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition hover:bg-[#B68D40]/10 hover:text-[#967235] dark:hover:text-[#C9A55A]"
                  >
                    <Icon className="h-4 w-4" strokeWidth={ICON_STROKE} />
                    {a.label}
                  </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        type="button"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-14 w-14 items-center justify-center rounded-2xl shadow-erp-gold transition",
          open ? "bg-muted text-foreground" : "bg-gradient-to-br from-[#B68D40] to-[#967235] text-[#071226]",
        )}
        aria-label={open ? "Close quick actions" : "Open quick actions"}
        aria-expanded={open}
      >
        {open ? <X className="h-5 w-5" strokeWidth={ICON_STROKE} /> : <Plus className="h-6 w-6" strokeWidth={ICON_STROKE} />}
      </motion.button>
    </div>
  );
}
