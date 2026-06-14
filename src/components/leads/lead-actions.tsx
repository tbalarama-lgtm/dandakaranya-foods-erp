"use client";

import { deleteLead } from "@/actions/leads";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { MessageCircle, Mail, Trash2 } from "lucide-react";

export function LeadActions({
  id,
  phone,
  email,
}: {
  id: string;
  phone: string;
  email?: string | null;
}) {
  const wa = phone.replace(/\D/g, "");
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="secondary" size="sm" asChild>
        <a href={`https://wa.me/${wa}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle className="h-3.5 w-3.5" />
          WhatsApp
        </a>
      </Button>
      {email && (
        <Button variant="secondary" size="sm" asChild>
          <a href={`mailto:${email}`}>
            <Mail className="h-3.5 w-3.5" />
            Email
          </a>
        </Button>
      )}
      <Button
        variant="destructive"
        size="sm"
        onClick={async () => {
          if (!confirm("Delete this lead?")) return;
          try {
            await deleteLead(id);
            toast.success("Lead deleted");
          } catch {
            toast.error("Delete failed");
          }
        }}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
