"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type StreamUpdate = {
  unread: number;
  latestAt: string | null;
  ts: number;
};

export function useNotificationStream(onUpdate?: (data: StreamUpdate) => void) {
  const [unread, setUnread] = useState(0);
  const [connected, setConnected] = useState(false);
  const onUpdateRef = useRef(onUpdate);

  useEffect(() => {
    onUpdateRef.current = onUpdate;
  }, [onUpdate]);

  const handleUpdate = useCallback((data: StreamUpdate) => {
    setUnread(data.unread);
    onUpdateRef.current?.(data);
  }, []);

  useEffect(() => {
    let es: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;
    let cancelled = false;

    const connect = () => {
      if (cancelled) return;
      es = new EventSource("/api/v1/notifications/stream");

      es.addEventListener("connected", () => {
        if (!cancelled) setConnected(true);
      });
      es.addEventListener("update", (e) => {
        if (cancelled) return;
        try {
          handleUpdate(JSON.parse(e.data));
        } catch {
          /* ignore */
        }
      });
      es.addEventListener("heartbeat", () => {
        if (!cancelled) setConnected(true);
      });

      es.onerror = () => {
        if (cancelled) return;
        setConnected(false);
        es?.close();
        retryTimer = setTimeout(connect, 5000);
      };
    };

    connect();

    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
      es?.close();
    };
  }, [handleUpdate]);

  return { unread, connected, setUnread };
}

export type NotificationsPayload = {
  items: Array<{
    id: string;
    title: string;
    message: string;
    read: boolean;
    link: string | null;
    category: string;
    severity: string;
    status: string;
    actions: Array<{ type: string; label: string; href?: string }>;
    createdAt: string;
    escalatedAt: string | null;
  }>;
  unread: number;
  counts: Record<string, number>;
};

export async function fetchNotifications(tab = "all", sync = false): Promise<NotificationsPayload> {
  const res = await fetch(`/api/v1/notifications?tab=${tab}${sync ? "&sync=1" : ""}`);
  if (!res.ok) throw new Error("Failed to load notifications");
  const body = (await res.json()) as { success?: boolean; data?: unknown };
  const payload =
    body?.data && typeof body.data === "object"
      ? (body.data as NotificationsPayload)
      : (body as NotificationsPayload);

  return {
    items: Array.isArray(payload?.items) ? payload.items : [],
    unread: typeof payload?.unread === "number" ? payload.unread : 0,
    counts:
      payload?.counts && typeof payload.counts === "object" && !Array.isArray(payload.counts)
        ? payload.counts
        : {},
  };
}
