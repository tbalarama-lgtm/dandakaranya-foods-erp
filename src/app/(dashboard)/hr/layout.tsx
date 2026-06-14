import { HrNav } from "@/components/hr/hr-nav";

export default function HrLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1600px]">
      <HrNav />
      {children}
    </div>
  );
}
