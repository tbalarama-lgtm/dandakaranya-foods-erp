"use client";

import { useCallback, useEffect, useState } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Plus, Trash2 } from "lucide-react";
import type { ExpenseRecord } from "@/lib/finance/types";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { PaymentStatusBadge } from "@/components/finance/payment-status-badge";
import { FinanceExportButtons } from "@/components/finance/finance-export-buttons";
import { AddExpenseDialog } from "@/components/finance/add-expense-dialog";
import { Button } from "@/components/ui/button";
import { formatInr } from "@/lib/utils";
import { toast } from "sonner";

const COLORS = ["#1d4e3a", "#2d6a4f", "#40916c", "#52b788", "#74c69d", "#95d5b2"];

export function FinanceExpensesClient({ initial }: { initial: ExpenseRecord[] }) {
  const [list, setList] = useState(initial);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/v1/finance/expenses");
      if (res.ok) {
        const json = await res.json();
        setList(json.data ?? []);
      }
    } catch {
      /* keep current list */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const byCat = Object.entries(
    list.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amount;
      return acc;
    }, {}),
  ).map(([name, value]) => ({ name, value }));

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this expense?")) return;
    try {
      const res = await fetch(`/api/v1/finance/expenses/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setList((prev) => prev.filter((e) => e.id !== id));
      toast.success("Expense deleted");
    } catch {
      toast.error("Delete failed — you may need finance.manage permission");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between gap-3">
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add expense
        </Button>
        <FinanceExportButtons filename="expenses" />
      </div>

      <AddExpenseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onAdded={(expense) => setList((prev) => [expense, ...prev])}
      />

      {loading && list.length === 0 && (
        <p className="text-sm text-muted-foreground">Loading expenses…</p>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <GlassCard className="lg:col-span-2">
          <GlassCardBody className="overflow-x-auto p-0">
            {list.length === 0 && !loading ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                No expenses yet. Click <strong>Add expense</strong> to create one.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/30 text-left text-xs uppercase text-muted-foreground">
                    <th className="px-4 py-2">Category</th>
                    <th className="px-4 py-2">Description</th>
                    <th className="px-4 py-2">Dept</th>
                    <th className="px-4 py-2">Date</th>
                    <th className="px-4 py-2">Amount</th>
                    <th className="px-4 py-2">Status</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {list.map((e) => (
                    <tr key={e.id} className="border-b border-border/40">
                      <td className="px-4 py-2">{e.category}</td>
                      <td className="px-4 py-2">{e.description}</td>
                      <td className="px-4 py-2 text-muted-foreground">{e.department ?? "—"}</td>
                      <td className="px-4 py-2 text-muted-foreground">{e.expenseDate}</td>
                      <td className="px-4 py-2 font-medium">{formatInr(e.amount)}</td>
                      <td className="px-4 py-2">
                        <PaymentStatusBadge status={e.status} />
                      </td>
                      <td className="px-4 py-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => handleDelete(e.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </GlassCardBody>
        </GlassCard>
        <GlassCard>
          <GlassCardHeader>
            <h3 className="font-semibold">By category</h3>
          </GlassCardHeader>
          <GlassCardBody className="h-[280px]">
            {byCat.length === 0 ? (
              <p className="flex h-full items-center justify-center text-sm text-muted-foreground">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCat} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                    {byCat.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatInr(Number(v ?? 0))} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </GlassCardBody>
        </GlassCard>
      </div>
    </div>
  );
}
