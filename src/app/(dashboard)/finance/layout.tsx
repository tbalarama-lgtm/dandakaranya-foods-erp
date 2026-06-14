import { FinanceNav } from "@/components/finance/finance-nav";

export default function FinanceLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1600px]">
      <FinanceNav />
      {children}
    </div>
  );
}
