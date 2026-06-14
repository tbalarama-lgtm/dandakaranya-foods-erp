"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { formatDate } from "@/lib/utils";

export function ActivityFeed({
  items,
}: {
  items: { id: string; message: string; userName: string | null; createdAt: Date }[];
}) {
  return (
    <div className="space-y-2">
      {items.map((a, i) => (
        <motion.div
          key={a.id}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.05, duration: 0.35 }}
          whileHover={{ x: 4, transition: { duration: 0.2 } }}
          className="glass-inset rounded-xl px-3 py-2.5 text-sm transition-colors hover:bg-white/40 dark:hover:bg-white/5"
        >
          <p className="font-medium leading-snug">{a.message}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {a.userName ?? "System"} · {formatDate(a.createdAt)}
          </p>
        </motion.div>
      ))}
      <Link
        href="/activity"
        className="inline-flex items-center gap-1 pt-1 text-xs font-medium text-primary transition hover:gap-2"
      >
        View full audit trail →
      </Link>
    </div>
  );
}
