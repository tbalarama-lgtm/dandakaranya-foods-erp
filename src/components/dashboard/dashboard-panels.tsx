"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowUpRight } from "lucide-react";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { ActivityFeed } from "@/components/dashboard/activity-feed";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function InventoryPanel({
  totalSkus,
  inStock,
  lowStockCount,
  lowStock,
}: {
  totalSkus: number;
  inStock: number;
  lowStockCount: number;
  lowStock: { id: string; name: string }[];
}) {
  return (
    <GlassCard delay={0.45} glow="amber">
      <GlassCardHeader>
        <h3 className="text-base font-semibold">Inventory status</h3>
      </GlassCardHeader>
      <GlassCardBody className="space-y-3 text-sm">
        <Row label="Total SKUs" value={String(totalSkus)} />
        <Row label="In stock" value={<Badge variant="muted">{inStock}</Badge>} />
        <Row label="Low stock" value={<Badge variant="danger">{lowStockCount}</Badge>} />
        {lowStock.length > 0 && (
          <div className="glass-inset mt-2 rounded-xl border border-amber-500/20 p-3">
            <p className="flex items-center gap-2 font-medium text-amber-800 dark:text-amber-300">
              <AlertTriangle className="h-4 w-4" />
              Low stock alerts
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {lowStock.slice(0, 5).map((p) => (
                <li key={p.id}>{p.name}</li>
              ))}
            </ul>
            <Button asChild variant="ghost" size="sm" className="mt-2 h-auto gap-1 p-0 text-primary">
              <Link href="/inventory">
                Manage inventory
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </GlassCardBody>
    </GlassCard>
  );
}

export function ActivityPanel({
  items,
}: {
  items: { id: string; message: string; userName: string | null; createdAt: Date }[];
}) {
  return (
    <GlassCard delay={0.5} glow="blue">
      <GlassCardHeader>
        <h3 className="text-base font-semibold">Real-time activity</h3>
      </GlassCardHeader>
      <GlassCardBody>
        <ActivityFeed items={items} />
      </GlassCardBody>
    </GlassCard>
  );
}

export function PipelinePanel({
  pipeline,
  conversionRatio,
}: {
  pipeline: { stage: string; count: number }[];
  conversionRatio: number;
}) {
  const max = Math.max(...pipeline.map((p) => p.count), 1);
  return (
    <GlassCard delay={0.55} glow="violet">
      <GlassCardHeader className="flex flex-row items-center justify-between">
        <h3 className="text-base font-semibold">Lead pipeline</h3>
        <Button asChild variant="ghost" size="sm" className="h-8 text-xs">
          <Link href="/leads/pipeline">View pipeline</Link>
        </Button>
      </GlassCardHeader>
      <GlassCardBody className="space-y-3">
        {pipeline.map((p, i) => (
          <motion.div
            key={p.stage}
            initial={{ opacity: 0, width: 0 }}
            animate={{ opacity: 1, width: "100%" }}
            transition={{ delay: 0.5 + i * 0.06 }}
            className="space-y-1"
          >
            <div className="flex justify-between text-sm">
              <span className="capitalize text-muted-foreground">
                {p.stage.toLowerCase().replace("_", " ")}
              </span>
              <Badge variant="muted">{p.count}</Badge>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/50">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500"
                initial={{ width: 0 }}
                animate={{ width: `${(p.count / max) * 100}%` }}
                transition={{ delay: 0.6 + i * 0.08, duration: 0.6, ease: "easeOut" }}
              />
            </div>
          </motion.div>
        ))}
        <p className="border-t border-white/20 pt-3 text-xs text-muted-foreground dark:border-white/10">
          Conversion ratio: <strong className="text-foreground">{conversionRatio}%</strong>
        </p>
      </GlassCardBody>
    </GlassCard>
  );
}

export function TopProductsPanel({
  products,
}: {
  products: { name: string; qty: number }[];
}) {
  return (
    <GlassCard delay={0.6} glow="emerald">
      <GlassCardHeader>
        <h3 className="text-base font-semibold">Top products</h3>
      </GlassCardHeader>
      <GlassCardBody>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {products.map((p, i) => (
            <motion.div
              key={p.name}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.65 + i * 0.04 }}
              whileHover={{ y: -2 }}
              className="glass-inset flex items-center justify-between rounded-xl px-3 py-2.5 text-sm"
            >
              <span>
                <span className="text-muted-foreground">{i + 1}. </span>
                <span className="font-medium">{p.name}</span>
              </span>
              <Badge variant="muted" className="ml-2 shrink-0">
                {p.qty}
              </Badge>
            </motion.div>
          ))}
        </div>
      </GlassCardBody>
    </GlassCard>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
