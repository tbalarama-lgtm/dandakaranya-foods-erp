import { AdminConsoleNav } from "@/components/admin/admin-console-nav";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <AdminConsoleNav />
      {children}
    </div>
  );
}
