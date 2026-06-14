"use client";

import { useState } from "react";
import type { HrNotification } from "@/lib/hr/types";
import { GlassCard, GlassCardBody } from "@/components/dashboard/glass-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Bell, Check } from "lucide-react";

const typeVariant: Record<string, "default" | "success" | "warning" | "danger"> = {
  LEAVE: "warning",
  PAYROLL: "success",
  ANNIVERSARY: "default",
  DOCUMENT: "danger",
  SHIFT: "default",
};

export function NotificationsClient({ items: initial }: { items: HrNotification[] }) {
  const [items, setItems] = useState(initial);

  const markRead = (id: string) => {
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  return (
    <div className="space-y-3">
      {items.map((n) => (
        <GlassCard key={n.id} className={n.read ? "opacity-70" : ""}>
          <GlassCardBody className="flex gap-4">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <Bell className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium">{n.title}</p>
                <Badge variant={typeVariant[n.type] ?? "default"}>{n.type}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">{n.message}</p>
              <p className="mt-1 text-[10px] text-muted-foreground">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </div>
            {!n.read && (
              <Button size="sm" variant="ghost" onClick={() => markRead(n.id)}>
                <Check className="h-4 w-4" />
              </Button>
            )}
          </GlassCardBody>
        </GlassCard>
      ))}
    </div>
  );
}
