import { ProductionNav } from "@/components/production/production-nav";

export default function ProductionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1600px]">
      <ProductionNav />
      {children}
    </div>
  );
}
