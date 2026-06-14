import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  ComplianceBadge,
  FpoPartnerBadge,
  VendorClassificationBadge,
  VendorStatusBadge,
} from "@/components/vendors/vendor-badges";
import { VendorDocuments } from "@/components/vendors/vendor-documents";
import {
  VendorAnalyticsPanel,
  VendorContractsPanel,
  VendorFinancialPanel,
  VendorFoodIntelligencePanel,
  VendorQualityPanel,
  VendorWorkflowPanel,
} from "@/components/vendors/vendor-panels";
import { VendorQuickActions } from "@/components/vendors/vendor-quick-actions";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  getVendorById,
  getVendorDetailExtras,
  getVendorPurchasesForDetail,
  getVendorQualityTrend,
  getVendorSpendTrend,
} from "@/lib/vendor-metrics";
import { formatDate, formatInr } from "@/lib/utils";
import { requirePermission } from "@/lib/session";
import type { VendorContract, VendorQualityRecord } from "@prisma/client";

export const dynamic = "force-dynamic";

export default async function VendorDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePermission("vendors.view");
  const { id } = await params;
  const sp = await searchParams;

  const vendor = await getVendorById(id);
  if (!vendor) notFound();

  const [extras, purchaseDtos, spendTrend, qualityTrend] = await Promise.all([
    getVendorDetailExtras(id),
    getVendorPurchasesForDetail(id),
    getVendorSpendTrend(id),
    getVendorQualityTrend(id),
  ]);

  const documents = extras.documents as {
    id: string;
    docType: import("@prisma/client").VendorDocType;
    name: string;
    fileUrl: string | null;
    expiresAt: Date | null;
    uploadedAt: Date;
  }[];
  const contracts = extras.contracts as VendorContract[];
  const qualityRecords = extras.qualityRecords as VendorQualityRecord[];

  const initials = vendor.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const showCompliance = sp.tab === "compliance";

  return (
    <div className="space-y-6">
      <PageHeader
        title={vendor.name}
        description={[vendor.code, vendor.gstin, vendor.phone].filter(Boolean).join(" · ")}
        action={{ label: "Back to vendors", href: "/vendors" }}
      />

      <div className="erp-kpi-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 border-2 border-[#B68D40]/30">
            <AvatarFallback className="bg-gradient-to-br from-[#1E3A5F] to-[#2A4A6F] text-lg font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap gap-2">
              <VendorClassificationBadge classification={vendor.classification} />
              <VendorStatusBadge status={vendor.status} />
              <ComplianceBadge score={vendor.complianceScore} />
              {vendor.isFpoPartner && <FpoPartnerBadge />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {vendor.purchaseCount} POs · {formatInr(vendor.totalSpend)} spend · Quality{" "}
              {vendor.qualityScore?.toFixed(1) ?? "—"}%
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href={`/vendors/${id}`}
            className={`rounded-lg px-3 py-1.5 ${!showCompliance ? "bg-[#B68D40]/15 font-semibold text-[#967235]" : "text-muted-foreground hover:bg-muted"}`}
          >
            Overview
          </Link>
          <Link
            href={`/vendors/${id}?tab=compliance`}
            className={`rounded-lg px-3 py-1.5 ${showCompliance ? "bg-[#B68D40]/15 font-semibold text-[#967235]" : "text-muted-foreground hover:bg-muted"}`}
          >
            Compliance
          </Link>
        </div>
      </div>

      <VendorQuickActions vendor={vendor} />

      {showCompliance ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <VendorDocuments documents={documents} />
          <VendorContractsPanel contracts={contracts} />
        </div>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <VendorFinancialPanel vendor={vendor} purchases={purchaseDtos} />
            <VendorAnalyticsPanel spendTrend={spendTrend} qualityTrend={qualityTrend} />
            <VendorFoodIntelligencePanel vendor={vendor} />
            <VendorQualityPanel records={qualityRecords} />
          </div>
          <div className="space-y-6">
            <VendorWorkflowPanel purchases={purchaseDtos} />
            <VendorContractsPanel contracts={contracts} />
            <div className="erp-kpi-card p-5">
              <h3 className="text-sm font-semibold">Multi-warehouse procurement</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                Preferred warehouse: {vendor.preferredWarehouseName ?? "Default · Main storage"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                POs can be routed to branch warehouses for regional raw material intake.
              </p>
            </div>
            <div className="erp-kpi-card p-5 text-sm">
              <h3 className="font-semibold">Contact & bank</h3>
              <dl className="mt-3 space-y-2 text-muted-foreground">
                <div>
                  <dt className="text-[10px] uppercase tracking-wider">Primary contact</dt>
                  <dd>{vendor.contact ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider">FSSAI</dt>
                  <dd>{vendor.fssaiNumber ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider">Bank</dt>
                  <dd>
                    {vendor.bankName ? `${vendor.bankName} · ${vendor.bankAccount}` : "—"}
                    {vendor.bankIfsc && ` · ${vendor.bankIfsc}`}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wider">Member since</dt>
                  <dd>{formatDate(new Date(vendor.createdAt))}</dd>
                </div>
              </dl>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
