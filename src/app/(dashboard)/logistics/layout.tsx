import { LogisticsNav } from "@/components/logistics/logistics-nav";

export default function LogisticsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <LogisticsNav />
      {children}
    </div>
  );
}
