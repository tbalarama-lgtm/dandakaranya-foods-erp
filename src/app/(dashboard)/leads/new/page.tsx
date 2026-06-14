import { PageHeader } from "@/components/layout/page-header";
import { LeadForm } from "@/components/leads/lead-form";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewLeadPage() {
  await requirePermission("leads.create");
  const assignees = await prisma.user.findMany({
    where: { active: true, role: { in: ["SALES_EXECUTIVE", "MANAGER", "ADMIN"] } },
    select: { id: true, name: true },
  });
  return (
    <div>
      <PageHeader title="Add lead" description="New B2B or export enquiry" />
      <LeadForm assignees={assignees} />
    </div>
  );
}
