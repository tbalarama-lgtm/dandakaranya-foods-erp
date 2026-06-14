import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, type LucideIcon } from "lucide-react";

export function ModulePage({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-primary">Module</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight md:text-3xl">{title}</h1>
          {description && <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}

export function FeatureGrid({
  features,
}: {
  features: {
    title: string;
    description: string;
    href?: string;
    status?: "live" | "beta" | "planned";
    icon: LucideIcon;
  }[];
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {features.map((f) => {
        const Icon = f.icon;
        const inner = (
          <Card className="h-full transition hover:border-primary/30 hover:shadow-erp-lg">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </div>
                {f.status && (
                  <Badge variant={f.status === "live" ? "default" : "muted"} className="text-[10px] uppercase">
                    {f.status}
                  </Badge>
                )}
              </div>
              <CardTitle className="text-base">{f.title}</CardTitle>
              <CardDescription>{f.description}</CardDescription>
            </CardHeader>
            {f.href && (
              <CardContent className="pt-0">
                <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </CardContent>
            )}
          </Card>
        );
        return f.href ? (
          <Link key={f.title} href={f.href} className="block">
            {inner}
          </Link>
        ) : (
          <div key={f.title}>{inner}</div>
        );
      })}
    </div>
  );
}

export function ModuleStats({ items }: { items: { label: string; value: string; hint?: string }[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardContent className="p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold">{item.value}</p>
            {item.hint && <p className="mt-1 text-xs text-muted-foreground">{item.hint}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

