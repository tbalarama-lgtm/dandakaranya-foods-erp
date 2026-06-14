"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createSupportTicket } from "@/actions/customers";
import { TICKET_PRIORITY_LABELS, TICKET_STATUS_LABELS } from "@/lib/customer-types";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

export function CustomerSupportTickets({
  customerId,
  tickets,
}: {
  customerId: string;
  tickets: {
    id: string;
    ticketNumber: string;
    subject: string;
    status: keyof typeof TICKET_STATUS_LABELS;
    priority: keyof typeof TICKET_PRIORITY_LABELS;
    createdAt: Date | string;
  }[];
}) {
  const router = useRouter();
  const [subject, setSubject] = useState("");

  return (
    <div className="erp-kpi-card p-5">
      <h3 className="text-sm font-semibold">Support tickets</h3>
      <div className="mt-3 flex gap-2">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="New ticket subject"
          className="h-9 flex-1 rounded-lg border border-border px-3 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={async () => {
            if (!subject.trim()) return;
            await createSupportTicket(customerId, { subject: subject.trim() });
            setSubject("");
            toast.success("Ticket created");
            router.refresh();
          }}
        >
          Create
        </Button>
      </div>
      <ul className="mt-4 space-y-2">
        {tickets.length === 0 ? (
          <li className="text-xs text-muted-foreground">No support tickets.</li>
        ) : (
          tickets.map((t) => (
            <li key={t.id} className="rounded-lg border border-border/50 px-3 py-2 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{t.ticketNumber}</span>
                <span className="text-xs uppercase text-muted-foreground">{TICKET_STATUS_LABELS[t.status]}</span>
              </div>
              <p>{t.subject}</p>
              <p className="text-[10px] text-muted-foreground">
                {TICKET_PRIORITY_LABELS[t.priority]} · {formatDate(new Date(t.createdAt))}
              </p>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
