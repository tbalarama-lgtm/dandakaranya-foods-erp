"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, FileText, Loader2, X } from "lucide-react";
import { AADHAAR_CONSENT_STATEMENT } from "@/lib/hr/aadhaar-consent";
import type { Employee } from "@/lib/hr/types";
import { HR_DEPARTMENTS } from "@/lib/hr/mock-data";
import { createEmployee, updateEmployee } from "@/actions/hr-employees";
import { validateEmployeeCompliance } from "@/lib/hr/employee-validation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SelectField } from "@/components/ui/select-field";
import { Button } from "@/components/ui/button";
import { GlassCard, GlassCardBody } from "@/components/dashboard/glass-card";
import { toast } from "sonner";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function EmployeeFormClient({ employee }: { employee?: Employee }) {
  const router = useRouter();
  const isEdit = Boolean(employee);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(employee?.photoUrl ?? null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [aadhaarAuthorized, setAadhaarAuthorized] = useState(Boolean(employee?.aadhaarAuthorized));

  const onPickPhoto = () => fileInputRef.current?.click();

  const onPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo must be 2 MB or smaller");
      e.target.value = "";
      return;
    }

    const type = file.type || "";
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const ok =
      ["image/jpeg", "image/png", "image/webp", "image/gif"].includes(type) ||
      ["jpg", "jpeg", "png", "webp", "gif"].includes(ext);
    if (!ok) {
      toast.error("Use JPG, PNG, WebP, or GIF");
      e.target.value = "";
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearPhoto = () => {
    setSelectedFile(null);
    setPreviewUrl(employee?.photoUrl ?? null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const form = e.currentTarget;
      const formData = new FormData(form);
      if (selectedFile) {
        formData.set("photo", selectedFile);
      }
      if (aadhaarAuthorized) {
        formData.set("aadhaarAuthorized", "true");
      } else {
        formData.delete("aadhaarAuthorized");
      }

      const compliance = validateEmployeeCompliance({
        bankAccountName: String(formData.get("bankAccountName") ?? ""),
        bankName: String(formData.get("bankName") ?? ""),
        bankAccountNumber: String(formData.get("bankAccountNumber") ?? ""),
        bankIfsc: String(formData.get("bankIfsc") ?? ""),
        aadhaarNumber: String(formData.get("aadhaarNumber") ?? ""),
        aadhaarAuthorized,
      });
      if (compliance) {
        toast.error(compliance);
        return;
      }

      const result = isEdit
        ? await updateEmployee(employee!.id, formData)
        : await createEmployee(formData);

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(isEdit ? "Employee updated" : "Employee created");
      router.push("/hr/employees");
      router.refresh();
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const displayName = employee?.name ?? "New employee";

  return (
    <GlassCard>
      <GlassCardBody>
        <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2 flex flex-col items-center gap-4 rounded-xl border border-dashed border-border/80 bg-muted/20 p-6 sm:flex-row sm:items-start">
            <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-full ring-2 ring-border bg-muted">
              {previewUrl ? (
                <Image
                  src={previewUrl}
                  alt={displayName}
                  fill
                  className="object-cover"
                  unoptimized={previewUrl.startsWith("blob:")}
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-primary/10 text-2xl font-semibold text-primary">
                  {initials(displayName)}
                </div>
              )}
            </div>
            <div className="flex flex-1 flex-col items-center text-center sm:items-start sm:text-left">
              <Label className="text-base font-medium">Profile photo</Label>
              <p className="mt-1 text-sm text-muted-foreground">
                JPG, PNG, WebP, or GIF — max 2 MB. Shown on the employee directory and profile.
              </p>
              <div className="mt-3 flex flex-wrap gap-2 justify-center sm:justify-start">
                <Button type="button" variant="outline" size="sm" onClick={onPickPhoto}>
                  <Camera className="mr-2 h-4 w-4" />
                  {previewUrl ? "Change photo" : "Upload photo"}
                </Button>
                {(selectedFile || (isEdit && previewUrl && previewUrl !== employee?.photoUrl)) && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearPhoto}>
                    <X className="mr-2 h-4 w-4" />
                    Reset
                  </Button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif"
                className="hidden"
                onChange={onPhotoChange}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="employeeNo">Employee ID</Label>
            <Input id="employeeNo" name="employeeNo" defaultValue={employee?.employeeNo} required />
          </div>
          <div>
            <Label htmlFor="name">Full name</Label>
            <Input id="name" name="name" defaultValue={employee?.name} required />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" defaultValue={employee?.email} required />
          </div>
          <div>
            <Label htmlFor="phone">Phone</Label>
            <Input id="phone" name="phone" defaultValue={employee?.phone} required />
          </div>
          <SelectField label="Department" name="department" defaultValue={employee?.department} required>
            {HR_DEPARTMENTS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </SelectField>
          <div>
            <Label htmlFor="designation">Designation</Label>
            <Input id="designation" name="designation" defaultValue={employee?.designation} required />
          </div>
          <div>
            <Label htmlFor="joinedAt">Joining date</Label>
            <Input id="joinedAt" name="joinedAt" type="date" defaultValue={employee?.joinedAt} required />
          </div>
          <div>
            <Label htmlFor="salary">Salary (₹)</Label>
            <Input id="salary" name="salary" type="number" defaultValue={employee?.salary} required />
          </div>
          <SelectField label="Employment type" name="employmentType" defaultValue={employee?.employmentType ?? "FULL_TIME"}>
            <option value="FULL_TIME">Full time</option>
            <option value="PART_TIME">Part time</option>
            <option value="CONTRACT">Contract</option>
            <option value="INTERN">Intern</option>
          </SelectField>
          <SelectField label="Shift" name="shift" defaultValue={employee?.shift ?? "General"}>
            <option value="Morning">Morning</option>
            <option value="General">General</option>
            <option value="Evening">Evening</option>
            <option value="Night">Night</option>
          </SelectField>
          <SelectField label="Status" name="status" defaultValue={employee?.status ?? "ACTIVE"}>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </SelectField>
          <div>
            <Label htmlFor="branchName">Branch</Label>
            <Input id="branchName" name="branchName" defaultValue={employee?.branchName ?? "Sukma HQ"} />
          </div>

          <div className="sm:col-span-2 border-t border-border/60 pt-6">
            <h3 className="text-sm font-semibold">Bank details</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              For salary credit. Fill all bank fields if you add any one of them.
            </p>
          </div>
          <div>
            <Label htmlFor="bankAccountName">Account holder name</Label>
            <Input
              id="bankAccountName"
              name="bankAccountName"
              defaultValue={employee?.bankAccountName}
              placeholder="As per bank passbook"
            />
          </div>
          <div>
            <Label htmlFor="bankName">Bank name</Label>
            <Input id="bankName" name="bankName" defaultValue={employee?.bankName} placeholder="e.g. State Bank of India" />
          </div>
          <div>
            <Label htmlFor="bankAccountNumber">Account number</Label>
            <Input
              id="bankAccountNumber"
              name="bankAccountNumber"
              inputMode="numeric"
              defaultValue={employee?.bankAccountNumber}
              placeholder="9–18 digits"
            />
          </div>
          <div>
            <Label htmlFor="bankIfsc">IFSC code</Label>
            <Input
              id="bankIfsc"
              name="bankIfsc"
              defaultValue={employee?.bankIfsc}
              placeholder="e.g. SBIN0001234"
              className="uppercase"
            />
          </div>
          <div className="sm:col-span-2">
            <Label htmlFor="bankBranch">Bank branch (optional)</Label>
            <Input id="bankBranch" name="bankBranch" defaultValue={employee?.bankBranch} placeholder="Branch / locality" />
          </div>

          <div className="sm:col-span-2 border-t border-border/60 pt-6">
            <h3 className="text-sm font-semibold">Aadhaar authorization</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Store Aadhaar only with written consent for payroll, statutory filings, and identity verification.
            </p>
          </div>
          <div>
            <Label htmlFor="aadhaarNumber">Aadhaar number</Label>
            <Input
              id="aadhaarNumber"
              name="aadhaarNumber"
              inputMode="numeric"
              maxLength={14}
              defaultValue={employee?.aadhaarNumber}
              placeholder="12-digit UID"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-border/80 bg-muted/20 p-4">
              <input
                type="checkbox"
                name="aadhaarAuthorized"
                value="true"
                checked={aadhaarAuthorized}
                onChange={(e) => setAadhaarAuthorized(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-border accent-primary"
              />
              <span className="text-sm leading-relaxed">
                <span className="font-medium">I confirm authorization</span>
                <span className="mt-1 block text-muted-foreground">{AADHAAR_CONSENT_STATEMENT}</span>
                {employee?.aadhaarAuthorizedAt && aadhaarAuthorized && (
                  <span className="mt-2 block text-xs text-muted-foreground">
                    Authorized on{" "}
                    {new Date(employee.aadhaarAuthorizedAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                )}
              </span>
            </label>
            <div className="mt-3">
              <Button type="button" variant="outline" size="sm" asChild>
                <Link
                  href={
                    employee?.id
                      ? `/hr/employees/${employee.id}/aadhaar-consent`
                      : "/hr/aadhaar-consent"
                  }
                  target="_blank"
                >
                  <FileText className="mr-2 h-4 w-4" />
                  Open printable consent form
                </Link>
              </Button>
            </div>
          </div>

          <div className="sm:col-span-2 flex gap-2 pt-2">
            <Button type="submit" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : isEdit ? (
                "Save changes"
              ) : (
                "Create employee"
              )}
            </Button>
            <Button type="button" variant="outline" disabled={submitting} onClick={() => router.back()}>
              Cancel
            </Button>
          </div>
        </form>
      </GlassCardBody>
    </GlassCard>
  );
}
