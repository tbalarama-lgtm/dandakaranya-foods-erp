import { QualityNav } from "@/components/quality/quality-nav";

export default function QualityLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <QualityNav />
      {children}
    </div>
  );
}
