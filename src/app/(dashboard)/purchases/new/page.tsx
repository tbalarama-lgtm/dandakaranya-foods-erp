import { PageHeader } from "@/components/layout/page-header";
import { PurchaseForm } from "@/components/purchases/purchase-form";
import { AddVendorDialog } from "@/components/vendors/add-vendor-dialog";
import { prisma } from "@/lib/db";
import { can } from "@/lib/rbac";
import { serializeProducts } from "@/lib/serialize-prisma";
import { getCurrentUser } from "@/lib/session";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function NewPurchasePage() {
  const user = await getCurrentUser();
  if (!user || !can(user.role, "purchases.create")) redirect("/");

  const [vendors, products] = await Promise.all([
    prisma.vendor.findMany({ orderBy: { name: "asc" } }),
    prisma.product.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);

  const canAddVendor = can(user.role, "vendors.create");

  return (
    <div>
      <PageHeader
        title="New purchase"
        description="Record vendor intake and update inventory"
        actions={canAddVendor ? <AddVendorDialog size="sm" /> : undefined}
      />
      <PurchaseForm
        vendors={vendors}
        products={serializeProducts(products)}
        canAddVendor={canAddVendor}
      />
    </div>
  );
}
