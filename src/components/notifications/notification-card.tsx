"use client";

import { markNotificationRead } from "@/actions/notifications";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export function NotificationCard({
  id,
  title,
  message,
  createdAt,
  read,
}: {
  id: string;
  title: string;
  message: string;
  createdAt: Date;
  read: boolean;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition hover:border-gold-500/30",
        read ? "opacity-60" : "border-gold-500/20 shadow-sm",
      )}
      onClick={async () => {
        if (!read) await markNotificationRead(id);
      }}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <p className="font-medium">{title}</p>
          {!read && <span className="h-2 w-2 shrink-0 rounded-full bg-gold-500" />}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        <p className="mt-2 text-xs text-muted-foreground">{formatDate(createdAt)}</p>
      </CardContent>
    </Card>
  );
}
