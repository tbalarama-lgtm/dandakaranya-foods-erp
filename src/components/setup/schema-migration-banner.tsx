import { AlertTriangle } from "lucide-react";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export function SchemaMigrationBanner({ module = "Purchase Orders" }: { module?: string }) {
  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
      <p className="flex items-start gap-2 font-medium">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={ICON_STROKE} />
        <span>
          {module} schema is out of date in the database. Run{" "}
          <code className="rounded bg-black/10 px-1 py-0.5 text-xs">npm run db:push</code> in{" "}
          <code className="rounded bg-black/10 px-1 py-0.5 text-xs">admin-dashboard</code>, then{" "}
          <code className="rounded bg-black/10 px-1 py-0.5 text-xs">npm run db:seed</code> if needed.
          Until then, data shown here may be empty.
        </span>
      </p>
    </div>
  );
}
