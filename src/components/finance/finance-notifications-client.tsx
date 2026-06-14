"use client";

import { useState } from "react";
import type { FinanceNotification } from "@/lib/finance/types";
import { GlassCard, GlassCardBody } from "@/components/dashboard/glass-card";
import { Badge } from "@/components/ui/badge";
import { Bell, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const priorityVariant: Record<string, "danger" | "warning" | "muted"> = {
  high: "danger",
  medium: "warning",
  low: "muted",
};

export function FinanceNotificationsClient({ items: initial }: { items: FinanceNotification[] }) {
  const [items, setItems] = useState(initial);

  return (
    <div className="space-y-3">
      {items.map((n) => (
        <GlassCard key={n.id} className={n.read ? "opacity-70" : ""}>
          <GlassCardBody className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{n.title}</p>
                <Badge variant="muted">{n.type}</Badge>
                <Badge variant={priorityVariant[n.priority]}>{n.priority}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{n.message}</p>
            </div>
            {!n.read && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)))}
              >
                <Check className="h-4 w-4" />
              </Button>
            )}
          </GlassCardBody>
        </GlassCard>
      ))}
    </div>
  );
}
