import type { LucideIcon } from "lucide-react";

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent = "forest",
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  accent?: "forest" | "gold" | "amber" | "red";
}) {
  const accents = {
    forest: "bg-forest-900/10 text-forest-800",
    gold: "bg-gold-500/15 text-gold-600",
    amber: "bg-amber-100 text-amber-800",
    red: "bg-red-100 text-red-800",
  };

  return (
    <div className="card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-forest-700">{label}</p>
          <p className="font-display mt-2 text-2xl font-semibold text-forest-900">{value}</p>
          {hint && <p className="mt-1 text-xs text-forest-900/55">{hint}</p>}
        </div>
        <span className={`rounded-xl p-2.5 ${accents[accent]}`}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      </div>
    </div>
  );
}
