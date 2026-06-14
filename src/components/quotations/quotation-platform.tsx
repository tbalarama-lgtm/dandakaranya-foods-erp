"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { QuotationFilters } from "@/components/quotations/quotation-filters";
import { QuotationKpis } from "@/components/quotations/quotation-kpis";
import { QuotationTable } from "@/components/quotations/quotation-table";
import { EmptyState } from "@/components/shared/empty-state";
import { FileText } from "lucide-react";
import type { QuotationAnalytics, QuotationListDto } from "@/lib/quotation-types";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export function QuotationPlatform({
  quotations,
  analytics,
}: {
  quotations: QuotationListDto[];
  analytics: QuotationAnalytics;
}) {
  return (
    <div className="space-y-6">
      <QuotationKpis analytics={analytics} />

      <Suspense fallback={null}>
        <QuotationFilters />
      </Suspense>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{quotations.length} quotation(s)</p>
        <Button variant="premium" asChild>
          <Link href="/quotations/new">
            <Plus className="h-4 w-4" strokeWidth={ICON_STROKE} />
            New quotation
          </Link>
        </Button>
      </div>

      {quotations.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No quotations yet"
          description="Create your first commercial quote with GST, export terms, and PDF generation."
          action={{ label: "New quotation", href: "/quotations/new" }}
        />
      ) : (
        <QuotationTable quotations={quotations} />
      )}
    </div>
  );
}
