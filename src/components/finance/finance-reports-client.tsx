"use client";

import { useState } from "react";
import { REPORT_TYPES } from "@/lib/finance/mock-data";
import { GlassCard, GlassCardBody } from "@/components/dashboard/glass-card";
import { FinanceExportButtons } from "@/components/finance/finance-export-buttons";
import { FinanceFiltersBar } from "@/components/finance/finance-filters";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { toast } from "sonner";

export function FinanceReportsClient() {
  const [branch, setBranch] = useState("All branches");
  const [period, setPeriod] = useState("mtd");

  return (
    <div className="space-y-6">
      <FinanceFiltersBar branch={branch} onBranch={setBranch} period={period} onPeriod={setPeriod} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORT_TYPES.map((name) => (
          <GlassCard key={name}>
            <GlassCardBody className="flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <FileText className="h-8 w-8 text-primary" />
                <p className="font-semibold">{name}</p>
              </div>
              <p className="text-xs text-muted-foreground">Branch: {branch} · {period.toUpperCase()}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="flex-1"
                  onClick={() => toast.success(`${name} PDF generated`)}
                >
                  PDF
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="flex-1"
                  onClick={() => toast.success(`${name} Excel generated`)}
                >
                  Excel
                </Button>
              </div>
            </GlassCardBody>
          </GlassCard>
        ))}
      </div>
      <div className="flex justify-end">
        <FinanceExportButtons filename="all-reports" />
      </div>
    </div>
  );
}
