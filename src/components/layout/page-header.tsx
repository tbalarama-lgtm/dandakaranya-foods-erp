import Link from "next/link";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function PageHeader({
  title,
  description,
  action,
  actions,
  className,
}: {
  title: string;
  description?: string;
  action?: { label: string; href: string };
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("erp-page-header flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#B68D40]/90">
          Enterprise ERP
        </p>
        <h1 className="erp-heading-page mt-1">{title}</h1>
        {description && <p className="erp-text-subtle mt-2 max-w-2xl">{description}</p>}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        {actions}
        {action && (
          <Button asChild size="sm" variant="premium">
            <Link href={action.href}>{action.label}</Link>
          </Button>
        )}
      </div>
    </div>
  );
}
