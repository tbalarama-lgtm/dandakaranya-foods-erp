"use client";

import { markAllNotificationsRead } from "@/actions/notifications";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export function MarkAllReadButton() {
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await markAllNotificationsRead();
          toast.success("All notifications marked as read");
        } catch {
          toast.error("Could not update notifications");
        }
      }}
    >
      Mark all read
    </Button>
  );
}
