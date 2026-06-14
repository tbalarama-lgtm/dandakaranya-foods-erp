import { PageHeader } from "@/components/layout/page-header";
import { CompanyForm } from "@/components/settings/company-form";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  await requirePermission("company.manage");
  const company = await prisma.companyProfile.findFirst({ where: { id: 1 } });
  return (
    <div>
      <PageHeader
        title="Company profile"
        description="Legal name, GSTIN, contact details, and logo URL used on exported invoice PDFs."
      />
      <CompanyForm company={company} />
    </div>
  );
}
