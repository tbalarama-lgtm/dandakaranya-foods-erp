import { getErpDashboardMetrics } from "@/lib/erp-metrics";
import { CommandCenter } from "@/components/dashboard/command-center";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const metrics = await getErpDashboardMetrics(user.id);

  return (
    <CommandCenter
      metrics={metrics}
      userName={user.name.split(" ")[0] ?? "there"}
      role={user.role}
    />
  );
}
