"use client";

import { useCallback, useEffect, useState } from "react";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { motion } from "framer-motion";
import {
  Bell,
  BellRing,
  RefreshCw,
  Settings2,
  Wifi,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarkAllReadButton } from "@/components/notifications/notification-actions";
import { NotificationItem, type NotificationItemData } from "@/components/notifications/notification-item";
import { NotificationPreferencesPanel } from "@/components/notifications/notification-preferences";
import { NOTIFICATION_TABS } from "@/lib/notification-types";
import type { NotificationTab } from "@/lib/notification-types";
import { fetchNotifications, useNotificationStream } from "@/hooks/use-notifications";
import { syncNotificationsAction } from "@/actions/notifications";
import { cn } from "@/lib/utils";
import { ICON_STROKE } from "@/lib/enterprise-ui";
import { toast } from "sonner";
import Link from "next/link";

export function NotificationCenter({
  initialUnread,
  initialCounts,
}: {
  initialUnread: number;
  initialCounts: Record<string, number>;
}) {
  const [tab, setTab] = useState<NotificationTab>("all");
  const [items, setItems] = useState<NotificationItemData[]>([]);
  const [unread, setUnread] = useState(initialUnread);
  const [counts, setCounts] = useState(initialCounts);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);
  const mounted = useIsMounted();

  const load = useCallback(
    async (t: NotificationTab) => {
      setLoading(true);
      try {
        const data = await fetchNotifications(t);
        if (!mounted.current) return;
        setItems(Array.isArray(data.items) ? (data.items as NotificationItemData[]) : []);
        setUnread(typeof data.unread === "number" ? data.unread : 0);
        setCounts(data.counts && typeof data.counts === "object" ? data.counts : {});
      } catch {
        if (!mounted.current) return;
        setItems([]);
        toast.error("Failed to load notifications");
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [mounted],
  );

  const onStreamUpdate = useCallback(
    (update: { unread: number }) => {
      if (!mounted.current) return;
      setUnread(update.unread);
      void load(tab);
    },
    [tab, load, mounted],
  );

  const { connected } = useNotificationStream(onStreamUpdate);

  useEffect(() => {
    void load(tab);
  }, [tab, load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncNotificationsAction();
      if (result.ok) {
        toast.success(`Synced ${result.count} workflow alerts`);
        await load(tab);
      }
    } finally {
      setSyncing(false);
    }
  };

  const safeItems = Array.isArray(items) ? items : [];
  const grouped = loading ? [] : groupItemsByDate(safeItems);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="erp-kpi-card flex flex-col gap-4 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-[#B68D40]/15 p-2.5">
            <BellRing className="h-5 w-5 text-[#B68D40]" strokeWidth={ICON_STROKE} />
          </div>
          <div>
            <p className="text-sm font-semibold">Alert & workflow center</p>
            <p className="text-xs text-muted-foreground">
              {unread > 0 ? `${unread} unread · live updates enabled` : "All caught up"}
            </p>
          </div>
          <LiveIndicator connected={connected} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" size="sm" variant="secondary" disabled={syncing} onClick={handleSync}>
            <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} strokeWidth={ICON_STROKE} />
            Sync rules
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => setPrefsOpen((v) => !v)}>
            <Settings2 className="h-4 w-4" strokeWidth={ICON_STROKE} />
            Preferences
          </Button>
          {unread > 0 && <MarkAllReadButton />}
        </div>
      </div>

      {prefsOpen && <NotificationPreferencesPanel onClose={() => setPrefsOpen(false)} />}

      {/* Category tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {NOTIFICATION_TABS.map((t) => {
          const countKey = t.id === "all" ? "all" : t.id === "alerts" ? "alert" : t.id;
          const badge = counts[countKey] ?? counts[t.id] ?? 0;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                "shrink-0 rounded-xl px-3.5 py-2 text-xs font-semibold transition",
                tab === t.id
                  ? "bg-gradient-to-r from-[#1E3A5F] to-[#2A4A6F] text-white shadow-sm"
                  : "bg-muted/60 text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
              {badge > 0 && (
                <span className="ml-1.5 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] text-white">
                  {badge > 99 ? "99+" : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="erp-kpi-card h-24 animate-pulse bg-muted/40" />
          ))}
        </div>
      ) : safeItems.length === 0 ? (
        <NotificationEmptyState onSync={handleSync} />
      ) : (
        <div className="space-y-8">
          {grouped.map((g) => (
            <section key={g.label}>
              <h3 className="mb-3 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {g.label}
              </h3>
              <div className="space-y-3">
                {g.items.map((item) => (
                  <NotificationItem key={item.id} item={item} onAction={() => load(tab)} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function LiveIndicator({ connected }: { connected: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium",
        connected ? "bg-emerald-500/12 text-emerald-600" : "bg-muted text-muted-foreground",
      )}
      title={connected ? "Live SSE stream connected" : "Reconnecting…"}
    >
      {connected ? (
        <Wifi className="h-3 w-3" strokeWidth={ICON_STROKE} />
      ) : (
        <WifiOff className="h-3 w-3" strokeWidth={ICON_STROKE} />
      )}
      Live
    </span>
  );
}

function groupItemsByDate(items: NotificationItemData[] | undefined | null) {
  const list = Array.isArray(items) ? items : [];
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfYesterday = new Date(startOfToday.getTime() - 86400000);
  const startOfWeek = new Date(startOfToday.getTime() - startOfToday.getDay() * 86400000);

  const buckets: { label: string; items: NotificationItemData[] }[] = [
    { label: "Today", items: [] },
    { label: "Yesterday", items: [] },
    { label: "This week", items: [] },
    { label: "Earlier", items: [] },
  ];

  for (const item of list) {
    const d = new Date(item.createdAt);
    if (d >= startOfToday) buckets[0].items.push(item);
    else if (d >= startOfYesterday) buckets[1].items.push(item);
    else if (d >= startOfWeek) buckets[2].items.push(item);
    else buckets[3].items.push(item);
  }

  return buckets.filter((b) => b.items.length > 0);
}

function NotificationEmptyState({ onSync }: { onSync: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="erp-kpi-card flex flex-col items-center px-6 py-16 text-center"
    >
      <div className="relative mb-6">
        <div className="absolute -inset-4 rounded-full bg-[#B68D40]/10 blur-xl" />
        <div className="relative rounded-2xl border border-[#B68D40]/20 bg-gradient-to-br from-[#1E3A5F]/10 to-[#B68D40]/10 p-6">
          <Bell className="h-12 w-12 text-[#B68D40]" strokeWidth={1.25} />
        </div>
      </div>
      <h3 className="font-display text-xl font-semibold">Your alert center is ready</h3>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        Workflow alerts for inventory, approvals, finance, production, and HR will appear here in
        real time. Run a sync to evaluate current ERP rules — low stock, overdue payments, leave
        requests, expiry batches, and more.
      </p>
      <ul className="mt-6 grid max-w-lg gap-2 text-left text-xs text-muted-foreground sm:grid-cols-2">
        {[
          "Low stock & raw material alerts",
          "Purchase & payment approvals",
          "Production QC & expiry tracking",
          "Failed login security alerts",
        ].map((tip) => (
          <li key={tip} className="flex items-center gap-2 rounded-lg bg-muted/40 px-3 py-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#B68D40]" />
            {tip}
          </li>
        ))}
      </ul>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <Button type="button" variant="premium" onClick={onSync}>
          <RefreshCw className="h-4 w-4" strokeWidth={ICON_STROKE} />
          Run workflow sync
        </Button>
        <Button type="button" variant="secondary" asChild>
          <Link href="/settings">Configure preferences</Link>
        </Button>
      </div>
    </motion.div>
  );
}
