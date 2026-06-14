"use client";

import { useState } from "react";
import type { LeaveBalance, LeaveRequest } from "@/lib/hr/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { LeaveStatusBadge } from "@/components/hr/status-badge";
import { MOCK_EMPLOYEES } from "@/lib/hr/mock-data";
import { toast } from "sonner";

export function LeaveClient({
  requests: initial,
  balances,
}: {
  requests: LeaveRequest[];
  balances: LeaveBalance[];
}) {
  const [requests, setRequests] = useState(initial);
  const updateStatus = (id: string, status: "APPROVED" | "REJECTED") => {
    setRequests((prev) => prev.map((r) => (r.id === id ? { ...r, status } : r)));
    toast.success(`Leave ${status.toLowerCase()}`, { description: "Notification sent (placeholder)" });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <GlassCard className="lg:col-span-1">
        <GlassCardHeader>
          <h3 className="font-semibold">Request leave</h3>
        </GlassCardHeader>
        <GlassCardBody>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              toast.success("Leave request submitted");
            }}
          >
            <SelectField label="Leave type" name="leaveType" required>
              <option value="SICK">Sick leave</option>
              <option value="CASUAL">Casual leave</option>
              <option value="PAID">Paid leave</option>
            </SelectField>
            <div>
              <Label>From</Label>
              <Input type="date" name="from" required />
            </div>
            <div>
              <Label>To</Label>
              <Input type="date" name="to" required />
            </div>
            <div>
              <Label>Reason</Label>
              <Input name="reason" placeholder="Optional" />
            </div>
            <Button type="submit" className="w-full">
              Submit request
            </Button>
          </form>
        </GlassCardBody>
      </GlassCard>

      <GlassCard className="lg:col-span-2">
        <GlassCardHeader>
          <h3 className="font-semibold">Approval workflow</h3>
        </GlassCardHeader>
        <GlassCardBody className="space-y-3">
          {requests.map((r) => (
            <div
              key={r.id}
              className="flex flex-col gap-3 rounded-xl border border-border/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-medium">{r.employeeName}</p>
                <p className="text-sm text-muted-foreground">
                  {r.leaveType} · {r.fromDate} → {r.toDate} ({r.days} days)
                </p>
              </div>
              <div className="flex items-center gap-2">
                <LeaveStatusBadge status={r.status} />
                {r.status === "PENDING" && (
                  <>
                    <Button size="sm" onClick={() => updateStatus(r.id, "APPROVED")}>
                      Approve
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => updateStatus(r.id, "REJECTED")}>
                      Reject
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </GlassCardBody>
      </GlassCard>

      <GlassCard className="lg:col-span-3">
        <GlassCardHeader>
          <h3 className="font-semibold">Leave balance tracker</h3>
        </GlassCardHeader>
        <GlassCardBody>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {balances.slice(0, 8).map((b) => {
              const emp = MOCK_EMPLOYEES.find((e) => e.id === b.employeeId);
              return (
                <div key={b.employeeId} className="rounded-xl bg-muted/40 p-3 text-sm">
                  <p className="font-medium">{emp?.name ?? b.employeeId}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Sick {b.sick} · Casual {b.casual} · Paid {b.paid}
                  </p>
                </div>
              );
            })}
          </div>
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}
