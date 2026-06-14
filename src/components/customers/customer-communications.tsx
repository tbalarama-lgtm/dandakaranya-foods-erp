"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CustomerCommChannel } from "@prisma/client";
import { addCustomerCommunication } from "@/actions/customers";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export function CustomerCommunications({
  customerId,
  items,
}: {
  customerId: string;
  items: {
    id: string;
    channel: CustomerCommChannel;
    message: string;
    createdAt: Date | string;
    user?: { name: string } | null;
  }[];
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<CustomerCommChannel>("NOTE");
  const [message, setMessage] = useState("");

  return (
    <div className="erp-kpi-card p-5">
      <h3 className="text-sm font-semibold">Communication history</h3>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <select
          value={channel}
          onChange={(e) => setChannel(e.target.value as CustomerCommChannel)}
          className="h-9 rounded-lg border border-border px-2 text-sm"
        >
          {(["PHONE", "EMAIL", "WHATSAPP", "MEETING", "NOTE"] as const).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <input
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Log call, email, meeting notes…"
          className="h-9 flex-1 rounded-lg border border-border px-3 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={async () => {
            if (!message.trim()) return;
            await addCustomerCommunication(customerId, channel, message.trim());
            setMessage("");
            toast.success("Communication logged");
            router.refresh();
          }}
        >
          Log
        </Button>
      </div>
      <ul className="mt-4 max-h-64 space-y-2 overflow-y-auto">
        {items.length === 0 ? (
          <li className="text-xs text-muted-foreground">No communications yet.</li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="rounded-lg border border-border/50 bg-muted/30 px-3 py-2 text-sm">
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                <span className="font-semibold uppercase text-foreground">{item.channel}</span>
                <span>{formatDate(new Date(item.createdAt))}</span>
                {item.user && <span>· {item.user.name}</span>}
              </div>
              <p className="mt-1">{item.message}</p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
