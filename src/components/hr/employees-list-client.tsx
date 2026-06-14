"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Eye, Pencil, Search, Trash2, UserPlus } from "lucide-react";
import type { Employee } from "@/lib/hr/types";
import { HR_DEPARTMENTS } from "@/lib/hr/mock-data";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { HrExportButtons } from "@/components/hr/hr-export-buttons";
import { EmployeeStatusBadge } from "@/components/hr/status-badge";
import { HrEmptyState } from "@/components/hr/hr-empty-state";
import { GlassCard, GlassCardBody } from "@/components/dashboard/glass-card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const selectClass = cn(
  "flex h-10 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500",
);

export function EmployeesListClient({ initial }: { initial: Employee[] }) {
  const [employees, setEmployees] = useState(initial);
  const [q, setQ] = useState("");
  const [dept, setDept] = useState("");
  const [status, setStatus] = useState("");

  const filtered = useMemo(() => {
    return employees.filter((e) => {
      const matchQ =
        !q ||
        e.name.toLowerCase().includes(q.toLowerCase()) ||
        e.employeeNo.toLowerCase().includes(q.toLowerCase()) ||
        e.email.toLowerCase().includes(q.toLowerCase());
      const matchDept = !dept || e.department === dept;
      const matchStatus = !status || e.status === status;
      return matchQ && matchDept && matchStatus;
    });
  }, [employees, q, dept, status]);

  const remove = (id: string) => {
    if (!confirm("Delete this employee record?")) return;
    setEmployees((prev) => prev.filter((e) => e.id !== id));
    toast.success("Employee removed (mock)");
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="grid flex-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search name, ID, email…"
              className="pl-9"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <select className={selectClass} value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">All departments</option>
            {HR_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <select className={selectClass} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>
        <div className="flex flex-wrap gap-2">
          <HrExportButtons filename="employees" />
          <Button asChild>
            <Link href="/hr/employees/new">
              <UserPlus className="mr-2 h-4 w-4" />
              Add employee
            </Link>
          </Button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <HrEmptyState title="No employees found" description="Adjust filters or add a new employee." />
      ) : (
        <GlassCard>
          <GlassCardBody className="overflow-x-auto p-0">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border/60 bg-muted/30 text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3">Employee</th>
                  <th className="px-4 py-3">Department</th>
                  <th className="px-4 py-3">Designation</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Joined</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((e, i) => (
                  <motion.tr
                    key={e.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/40 hover:bg-muted/20"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-9 w-9">
                          {e.photoUrl ? <AvatarImage src={e.photoUrl} alt={e.name} /> : null}
                          <AvatarFallback className="bg-primary/10 text-xs text-primary">
                            {initials(e.name)}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="font-medium">{e.name}</p>
                          <p className="text-xs text-muted-foreground">{e.employeeNo}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">{e.department}</td>
                    <td className="px-4 py-3">{e.designation}</td>
                    <td className="px-4 py-3">
                      <p>{e.phone}</p>
                      <p className="text-xs text-muted-foreground">{e.email}</p>
                    </td>
                    <td className="px-4 py-3">{e.joinedAt}</td>
                    <td className="px-4 py-3">
                      <EmployeeStatusBadge active={e.status === "ACTIVE"} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/hr/employees/${e.id}`}>
                            <Eye className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" asChild>
                          <Link href={`/hr/employees/${e.id}/edit`}>
                            <Pencil className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => remove(e.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </GlassCardBody>
        </GlassCard>
      )}
    </div>
  );
}
