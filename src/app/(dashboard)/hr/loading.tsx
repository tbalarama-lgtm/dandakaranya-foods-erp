import { HrCardSkeleton, HrTableSkeleton } from "@/components/hr/hr-skeleton";

export default function HrLoading() {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <HrCardSkeleton key={i} />
        ))}
      </div>
      <HrTableSkeleton rows={6} />
    </div>
  );
}
