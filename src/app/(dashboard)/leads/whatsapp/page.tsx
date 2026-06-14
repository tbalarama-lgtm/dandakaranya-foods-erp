import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/safe-prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { MessageCircle } from "lucide-react";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function WhatsAppLeadsPage() {
  const messages = await safeQuery(
    () =>
      prisma.leadCommunication.findMany({
        where: { channel: "WHATSAPP" },
        orderBy: { sentAt: "desc" },
        take: 50,
        include: {
          lead: { select: { company: true, contactName: true } },
          user: { select: { name: true } },
        },
      }),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="WhatsApp integration"
        description="UI for client communication logs. Connect WhatsApp Business API in Admin → Integrations."
      />
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <MessageCircle className="h-5 w-5 text-primary" />
            Integration status
          </CardTitle>
          <CardDescription>Configure provider credentials under Settings → API integrations.</CardDescription>
        </CardHeader>
        <CardContent>
          <Badge variant="muted">UI ready · API pending</Badge>
        </CardContent>
      </Card>
      <div className="space-y-3">
        {messages.map((m) => (
          <Card key={m.id}>
            <CardContent className="p-4 text-sm">
              <p className="font-medium">
                {m.lead.company} — {m.lead.contactName}
              </p>
              <p className="mt-1 text-muted-foreground">{m.message}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                {m.user?.name ?? "System"} · {formatDate(m.sentAt)}
              </p>
            </CardContent>
          </Card>
        ))}
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">No WhatsApp messages logged yet.</p>
        )}
      </div>
    </div>
  );
}
