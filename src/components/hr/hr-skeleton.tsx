export function HrTableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-14 animate-pulse rounded-xl bg-muted/60" />
      ))}
    </div>
  );
}

export function HrCardSkeleton() {
  return <div className="h-32 animate-pulse rounded-2xl bg-muted/60" />;
}
