"use client";

import { formatDate } from "@/lib/utils";
import { CRM_SOURCE_LABELS } from "@/lib/crm-types";
import type { CommunicationChannel } from "@prisma/client";
import { Phone, Mail, MessageCircle, Calendar, FileText, StickyNote } from "lucide-react";

const CHANNEL_ICON: Record<CommunicationChannel, React.ElementType> = {
  PHONE: Phone,
  EMAIL: Mail,
  WHATSAPP: MessageCircle,
  MEETING: Calendar,
  NOTE: StickyNote,
  FOLLOW_UP: Calendar,
  QUOTATION: FileText,
};

export function CrmTimeline({
  items,
}: {
  items: {
    id: string;
    channel: CommunicationChannel;
    message: string;
    sentAt: Date | string;
    user?: { name: string } | null;
  }[];
}) {
  if (items.length === 0) {
    return <p className="text-sm text-muted-foreground">No activity logged yet.</p>;
  }

  return (
    <ul className="relative space-y-4 before:absolute before:left-4 before:top-2 before:h-[calc(100%-8px)] before:w-px before:bg-border">
      {items.map((item) => {
        const Icon = CHANNEL_ICON[item.channel] ?? StickyNote;
        return (
          <li key={item.id} className="relative pl-10">
            <span className="absolute left-0 flex h-8 w-8 items-center justify-center rounded-full border border-[#B68D40]/30 bg-[#B68D40]/10">
              <Icon className="h-4 w-4 text-[#B68D40]" />
            </span>
            <div className="rounded-xl border border-border/50 bg-muted/30 p-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold uppercase tracking-wider text-foreground">{item.channel.replace("_", " ")}</span>
                <span>{formatDate(new Date(item.sentAt))}</span>
                {item.user && <span>· {item.user.name}</span>}
              </div>
              <p className="mt-1 text-sm leading-relaxed">{item.message}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

export function CrmExportFields({
  lead,
}: {
  lead: {
    country: string | null;
    moq: string | null;
    packagingPreference: string | null;
    shippingTerms: string | null;
    certifications: string | null;
    distributorName: string | null;
    productCategories: string | null;
    leadSource: keyof typeof CRM_SOURCE_LABELS | null;
  };
}) {
  const fields = [
    { label: "Country", value: lead.country },
    { label: "MOQ", value: lead.moq ?? lead.moq },
    { label: "Packaging", value: lead.packagingPreference },
    { label: "Shipping terms", value: lead.shippingTerms },
    { label: "Certifications", value: lead.certifications },
    { label: "Distributor", value: lead.distributorName },
    { label: "Product categories", value: lead.productCategories },
    { label: "Source", value: lead.leadSource ? CRM_SOURCE_LABELS[lead.leadSource] : null },
  ];

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {fields.map((f) => (
        <div key={f.label} className="rounded-lg bg-muted/40 px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</p>
          <p className="text-sm font-medium">{f.value || "—"}</p>
        </div>
      ))}
    </div>
  );
}
