"use client";

import Link from "next/link";
import { CreditCard, FileText, FileUp, Pencil, Upload } from "lucide-react";
import type { Employee } from "@/lib/hr/types";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardBody, GlassCardHeader } from "@/components/dashboard/glass-card";
import { EmployeeStatusBadge } from "@/components/hr/status-badge";
import { maskAadhaar, maskBankAccount } from "@/lib/hr/employee-validation";
import { toast } from "sonner";

export function EmployeeProfileClient({ employee }: { employee: Employee }) {
  const initials = employee.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <GlassCard className="lg:col-span-1">
        <GlassCardBody className="flex flex-col items-center text-center">
          <Avatar className="h-24 w-24">
            {employee.photoUrl ? (
              <AvatarImage src={employee.photoUrl} alt={employee.name} />
            ) : null}
            <AvatarFallback className="text-2xl bg-primary/10 text-primary">{initials}</AvatarFallback>
          </Avatar>
          <h2 className="mt-4 text-xl font-semibold">{employee.name}</h2>
          <p className="text-sm text-muted-foreground">{employee.designation}</p>
          <p className="text-xs text-muted-foreground">{employee.employeeNo}</p>
          <div className="mt-3">
            <EmployeeStatusBadge active={employee.status === "ACTIVE"} />
          </div>
          <Button asChild className="mt-4 w-full" variant="outline">
            <Link href={`/hr/employees/${employee.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit profile
            </Link>
          </Button>
          <Button
            className="mt-2 w-full"
            variant="secondary"
            onClick={() => toast.success("ID card PDF generated (placeholder)")}
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Generate ID card
          </Button>
        </GlassCardBody>
      </GlassCard>

      <GlassCard className="lg:col-span-2">
        <GlassCardHeader>
          <h3 className="font-semibold">Employee details</h3>
        </GlassCardHeader>
        <GlassCardBody>
          <dl className="grid gap-4 sm:grid-cols-2">
            {[
              ["Department", employee.department],
              ["Branch", employee.branchName ?? "—"],
              ["Email", employee.email],
              ["Phone", employee.phone],
              ["Joined", employee.joinedAt],
              ["Salary", `₹${employee.salary.toLocaleString("en-IN")}`],
              ["Employment", employee.employmentType.replace("_", " ")],
              ["Shift", employee.shift],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-xs uppercase text-muted-foreground">{k}</dt>
                <dd className="mt-0.5 font-medium">{v}</dd>
              </div>
            ))}
          </dl>
        </GlassCardBody>
      </GlassCard>

      <GlassCard className="lg:col-span-2">
        <GlassCardHeader>
          <h3 className="font-semibold">Bank details</h3>
        </GlassCardHeader>
        <GlassCardBody>
          {employee.bankName || employee.bankAccountNumber ? (
            <dl className="grid gap-4 sm:grid-cols-2">
              {[
                ["Account holder", employee.bankAccountName ?? "—"],
                ["Bank", employee.bankName ?? "—"],
                ["Account number", maskBankAccount(employee.bankAccountNumber)],
                ["IFSC", employee.bankIfsc ?? "—"],
                ["Branch", employee.bankBranch ?? "—"],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-xs uppercase text-muted-foreground">{k}</dt>
                  <dd className="mt-0.5 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="text-sm text-muted-foreground">No bank details on file.</p>
          )}
        </GlassCardBody>
      </GlassCard>

      <GlassCard>
        <GlassCardHeader>
          <h3 className="font-semibold">Aadhaar</h3>
        </GlassCardHeader>
        <GlassCardBody>
          <dl className="space-y-3">
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Aadhaar (masked)</dt>
              <dd className="mt-0.5 font-medium">{maskAadhaar(employee.aadhaarNumber)}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-muted-foreground">Authorization</dt>
              <dd className="mt-0.5 font-medium">
                {employee.aadhaarAuthorized ? (
                  <span className="text-emerald-600 dark:text-emerald-400">Authorized</span>
                ) : (
                  <span className="text-amber-600 dark:text-amber-400">Not authorized</span>
                )}
              </dd>
            </div>
            {employee.aadhaarAuthorizedAt && (
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Authorized on</dt>
                <dd className="mt-0.5 text-sm">
                  {new Date(employee.aadhaarAuthorizedAt).toLocaleString("en-IN", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  })}
                </dd>
              </div>
            )}
          </dl>
          <Button asChild className="mt-4 w-full" variant="outline" size="sm">
            <Link href={`/hr/employees/${employee.id}/aadhaar-consent`}>
              <FileText className="mr-2 h-4 w-4" />
              Print consent form
            </Link>
          </Button>
        </GlassCardBody>
      </GlassCard>

      <GlassCard className="lg:col-span-3">
        <GlassCardHeader>
          <h3 className="font-semibold">Documents</h3>
        </GlassCardHeader>
        <GlassCardBody>
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-8">
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="mt-2 text-sm text-muted-foreground">Upload offer letter, ID proof, contracts</p>
            <Button className="mt-3" variant="outline" onClick={() => toast.info("Document upload — API placeholder")}>
              <FileUp className="mr-2 h-4 w-4" />
              Upload document
            </Button>
          </div>
        </GlassCardBody>
      </GlassCard>
    </div>
  );
}
