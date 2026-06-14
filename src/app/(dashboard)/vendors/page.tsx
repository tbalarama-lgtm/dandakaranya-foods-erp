import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { VendorPlatform } from "@/components/vendors/vendor-platform";
import { getVendorAnalytics, getVendors } from "@/lib/vendor-metrics";
import { requirePermission } from "@/lib/session";
import type { VendorClassification, VendorStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function VendorsPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    classification?: string;
    status?: string;
    sort?: string;
    fpoOnly?: string;
  }>;
}) {
  await requirePermission("vendors.view");
  const sp = await searchParams;

  const [vendors, analytics] = await Promise.all([
    getVendors({
      q: sp.q,
      classification: sp.classification as VendorClassification | undefined,
      status: sp.status as VendorStatus | undefined,
      sort: (sp.sort as "name" | "spend" | "outstanding" | "quality" | "recent") || undefined,
      fpoOnly: sp.fpoOnly === "1",
    }),
    getVendorAnalytics(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Supplier & Procurement Master"
        description="Enterprise vendor management · procurement workflow · food industry compliance"
      />
      <Suspense fallback={null}>
        <VendorPlatform vendors={vendors} analytics={analytics} />
      </Suspense>
    </div>
  );
}
