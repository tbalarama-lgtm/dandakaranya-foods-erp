"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PayrollRecord } from "@/lib/hr/types";
import { generateMonthlyPayroll } from "@/actions/hr-payroll";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { Badge } from "@/components/ui/badge";
import { HrExportButtons } from "@/components/hr/hr-export-buttons";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export function PayrollClient({
  initialRecords,
  periodLabel,
  dataSource,
}: {
  initialRecords: PayrollRecord[];
  periodLabel: string;
  dataSource: "database" | "mock";
}) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const paidCount = records.filter((r) => r.status === "PAID").length;

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await generateMonthlyPayroll();
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setRecords(result.records);
      router.refresh();

      if (result.mode === "mock") {
        toast.success(
          result.message ??
            `Demo payroll generated for ${result.count} employees — ${result.periodLabel}`,
        );
      } else {
        const parts = [`Payroll generated for ${result.periodLabel}`];
        if (result.created > 0) parts.push(`${result.created} new`);
        if (result.updated > 0) parts.push(`${result.updated} updated`);
        toast.success(`${parts.join(" · ")} (${result.count} employees)`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payroll generation failed");
    } finally {
      setGenerating(false);
    }
  };

  const downloadPayslip = async (record: PayrollRecord) => {
    setLoadingId(record.id);
    try {
      const res = await fetch(`/api/hr/payroll/${encodeURIComponent(record.id)}/payslip`);
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error ?? "Failed to generate payslip");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        res.headers.get("Content-Disposition")?.match(/filename="(.+)"/)?.[1] ??
        `payslip-${record.employeeName.replace(/\s+/g, "-")}.pdf`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Payslip downloaded — ${record.employeeName}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Payslip generation failed");
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            Pay period: <span className="font-medium text-foreground">{periodLabel}</span>
            {" · "}
            {records.length} employees
            {paidCount > 0 ? ` · ${paidCount} paid` : ""}
            {dataSource === "mock" ? " · demo data" : ""}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Generating…
              </>
            ) : (
              "Generate monthly salary"
            )}
          </Button>
          <HrExportButtons filename="payroll" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          { label: "Salary structure", desc: "Basic + HRA + special" },
          { label: "Allowances", desc: "Travel, food, shift" },
          { label: "Deductions", desc: "PF, ESI, TDS placeholders" },
        ].map((c) => (
          <GlassCard key={c.label}>
            <GlassCardBody>
              <p className="font-medium">{c.label}</p>
              <p className="text-xs text-muted-foreground">{c.desc}</p>
            </GlassCardBody>
          </GlassCard>
        ))}
      </div>

      <GlassCard>
        <GlassCardHeader>
          <h3 className="font-semibold">Payroll history</h3>
        </GlassCardHeader>
        <GlassCardBody className="overflow-x-auto p-0">
          {records.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No payroll records yet. Click &quot;Generate monthly salary&quot; to create entries for active
              employees.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                  <th className="px-4 py-2">Employee</th>
                  <th className="px-4 py-2">Period</th>
                  <th className="px-4 py-2">Gross</th>
                  <th className="px-4 py-2">Allowances</th>
                  <th className="px-4 py-2">Deductions</th>
                  <th className="px-4 py-2">PF</th>
                  <th className="px-4 py-2">ESI</th>
                  <th className="px-4 py-2">Bonus</th>
                  <th className="px-4 py-2">Net</th>
                  <th className="px-4 py-2">Status</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {records.map((r) => (
                  <tr key={r.id} className="border-b border-border/40">
                    <td className="px-4 py-2 font-medium">{r.employeeName}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {new Date(r.year, r.month - 1).toLocaleDateString("en-IN", {
                        month: "short",
                        year: "numeric",
                      })}
                    </td>
                    <td className="px-4 py-2">₹{r.grossPay.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2">₹{r.allowances.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2">₹{r.deductions.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2">₹{r.pf.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2">₹{r.esi.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2">₹{r.bonus.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2 font-semibold">₹{r.netPay.toLocaleString("en-IN")}</td>
                    <td className="px-4 py-2">
                      <Badge variant={r.status === "PAID" ? "success" : "warning"}>{r.status}</Badge>
                    </td>
                    <td className="px-4 py-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={loadingId === r.id}
                        onClick={() => downloadPayslip(r)}
                      >
                        {loadingId === r.id ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            Generating…
                          </>
                        ) : (
                          "Payslip"
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}
