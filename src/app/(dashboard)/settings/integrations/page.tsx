import { prisma } from "@/lib/db";
import { safeQuery } from "@/lib/safe-prisma";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function IntegrationsPage() {
  const integrations = await safeQuery(
    () => prisma.apiIntegration.findMany({ orderBy: { label: "asc" } }),
    [],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="API integrations"
        description="WhatsApp, payment gateways, shipping, and backup providers."
      />
      <div className="grid gap-4 md:grid-cols-2">
        {integrations.map((i) => (
          <Card key={i.id}>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base">{i.label}</CardTitle>
                <CardDescription>{i.provider}</CardDescription>
              </div>
              <Badge variant={i.enabled ? "default" : "muted"}>{i.enabled ? "On" : "Off"}</Badge>
            </CardHeader>
            <CardContent>
              <span className="text-sm text-muted-foreground">
                {i.enabled ? "Connected" : "Disabled — configure in .env / admin"}
              </span>
            </CardContent>
          </Card>
        ))}
        {integrations.length === 0 && (
          <p className="text-sm text-muted-foreground">No integrations configured. Run db:seed.</p>
        )}
      </div>
    </div>
  );
}
