"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useIsMounted } from "@/hooks/use-is-mounted";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { NotificationItem, type NotificationItemData } from "@/components/notifications/notification-item";
import { fetchNotifications, useNotificationStream } from "@/hooks/use-notifications";
import { markAllNotificationsRead } from "@/actions/notifications";
import { ICON, ICON_STROKE } from "@/lib/enterprise-ui";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function NotificationDropdown({
  initialUnread,
}: {
  initialUnread: number;
}) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<NotificationItemData[]>([]);
  const [loading, setLoading] = useState(false);
  const mounted = useIsMounted();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNotifications("all");
      if (!mounted.current) return;
      setItems(Array.isArray(data.items) ? data.items.slice(0, 8) as NotificationItemData[] : []);
      setUnread(data.unread);
    } catch {
      /* silent in dropdown */
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [mounted]);

  const onStreamUpdate = useCallback(
    (update: { unread: number }) => {
      if (!mounted.current) return;
      setUnread(update.unread);
      if (open) void load();
    },
    [open, load, mounted],
  );

  useNotificationStream(onStreamUpdate);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  useEffect(() => {
    setUnread(initialUnread);
  }, [initialUnread]);

  const markAll = async () => {
    await markAllNotificationsRead();
    setUnread(0);
    setItems((prev) => prev.map((i) => ({ ...i, read: true })));
    toast.success("All marked as read");
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <motion.button
          type="button"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-[#102544]/10 hover:text-foreground dark:hover:bg-white/5"
          aria-label="Notifications"
        >
          <Bell style={{ width: ICON.md, height: ICON.md }} strokeWidth={ICON_STROKE} />
          <AnimatePresence>
            {unread > 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                className="absolute right-1.5 top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white shadow-[0_0_8px_rgba(239,68,68,0.5)]"
              >
                {unread > 9 ? "9+" : unread}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[min(100vw-2rem,420px)] p-0"
        sideOffset={8}
      >
        <div className="border-b border-border/60 bg-gradient-to-r from-[#1E3A5F]/5 to-[#B68D40]/5 px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold">Notifications</p>
              <p className="text-[11px] text-muted-foreground">
                {unread > 0 ? `${unread} unread alerts` : "You're all caught up"}
              </p>
            </div>
            {unread > 0 && (
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs" onClick={markAll}>
                Mark all read
              </Button>
            )}
          </div>
        </div>

        <div className="max-h-[min(70vh,480px)] overflow-y-auto p-3">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/50" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="py-10 text-center">
              <Bell className="mx-auto h-8 w-8 text-muted-foreground/50" strokeWidth={1.25} />
              <p className="mt-2 text-sm text-muted-foreground">No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {items.map((item) => (
                <NotificationItem
                  key={item.id}
                  item={item}
                  compact
                  onAction={load}
                />
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-border/60 p-2">
          <Button type="button" variant="secondary" className="w-full" size="sm" asChild>
            <Link href="/notifications" onClick={() => setOpen(false)}>
              Open notification center
              <ExternalLink className="ml-1 h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
