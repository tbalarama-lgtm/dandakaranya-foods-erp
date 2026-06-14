import { Suspense } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { CustomerPlatform } from "@/components/customers/customer-platform";
import { getCustomerAnalytics, getCustomers } from "@/lib/customer-metrics";
import { requirePermission } from "@/lib/session";
import type { CustomerCreditRisk, CustomerSegment, CustomerStatus } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{
    q?: string;
    segment?: string;
    status?: string;
    risk?: string;
    sort?: string;
    highValue?: string;
  }>;
}) {
  await requirePermission("sales.view");
  const sp = await searchParams;

  const [customers, analytics] = await Promise.all([
    getCustomers({
      q: sp.q,
      segment: sp.segment as CustomerSegment | undefined,
      status: sp.status as CustomerStatus | undefined,
      risk: sp.risk as CustomerCreditRisk | undefined,
      sort: (sp.sort as "name" | "ltv" | "outstanding" | "recent") || undefined,
      highValue: sp.highValue === "1",
    }),
    getCustomerAnalytics(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer Master"
        description="Enterprise customer relationship management · financial integration · export intelligence"
      />
      <Suspense fallback={null}>
        <CustomerPlatform customers={customers} analytics={analytics} />
      </Suspense>
    </div>
  );
}
