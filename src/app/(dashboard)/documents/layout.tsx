import { DocumentsNav } from "@/components/documents/documents-nav";

export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[1600px]">
      <DocumentsNav />
      {children}
    </div>
  );
}
