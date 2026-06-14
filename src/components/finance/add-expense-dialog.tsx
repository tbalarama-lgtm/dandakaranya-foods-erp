"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { EXPENSE_CATEGORY_OPTIONS } from "@/lib/finance/expense-categories";
import { FINANCE_BRANCHES } from "@/lib/finance/mock-data";
import { toast } from "sonner";

const DEPARTMENTS = ["Production", "Procurement", "Operations", "Logistics", "Sales", "Admin", "Finance", "HR"];

export function AddExpenseDialog({
  open,
  onOpenChange,
  onAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded?: (expense: import("@/lib/finance/types").ExpenseRecord) => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    category: "Utilities",
    description: "",
    amount: "",
    department: "Operations",
    expenseDate: new Date().toISOString().slice(0, 10),
    branchName: "Sukma HQ",
  });

  const reset = () => {
    setForm({
      category: "Utilities",
      description: "",
      amount: "",
      department: "Operations",
      expenseDate: new Date().toISOString().slice(0, 10),
      branchName: "Sukma HQ",
    });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/v1/finance/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Failed to save expense");
      }
      toast.success("Expense added successfully");
      onAdded?.(json.data);
      onOpenChange(false);
      reset();
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not add expense");
    } finally {
      setLoading(false);
    }
  };

  const selectClass =
    "mt-1.5 flex h-10 w-full rounded-xl border border-border bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add expense</DialogTitle>
          <DialogDescription>Record operational spend. Saved to your finance database.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor="exp-category">Category</Label>
            <select
              id="exp-category"
              className={selectClass}
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              required
            >
              {EXPENSE_CATEGORY_OPTIONS.map((o) => (
                <option key={o.label} value={o.label}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="exp-desc">Description</Label>
            <Input
              id="exp-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Electricity bill — May"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="exp-amount">Amount (₹)</Label>
              <Input
                id="exp-amount"
                type="number"
                min="1"
                step="0.01"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0"
                required
              />
            </div>
            <div>
              <Label htmlFor="exp-date">Date</Label>
              <Input
                id="exp-date"
                type="date"
                value={form.expenseDate}
                onChange={(e) => setForm({ ...form, expenseDate: e.target.value })}
                required
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="exp-dept">Department</Label>
              <select
                id="exp-dept"
                className={selectClass}
                value={form.department}
                onChange={(e) => setForm({ ...form, department: e.target.value })}
              >
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label htmlFor="exp-branch">Branch</Label>
              <select
                id="exp-branch"
                className={selectClass}
                value={form.branchName}
                onChange={(e) => setForm({ ...form, branchName: e.target.value })}
              >
                {FINANCE_BRANCHES.filter((b) => b !== "All branches").map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
