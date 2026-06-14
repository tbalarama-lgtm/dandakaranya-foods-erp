"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import type { Vendor } from "@prisma/client";
import { VendorClassification, VendorPaymentTerms, VendorStatus } from "@prisma/client";
import { createVendor, updateVendor } from "@/actions/vendors";
import type { VendorDetailDto } from "@/lib/vendor-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  VENDOR_CLASSIFICATION_LABELS,
  VENDOR_PAYMENT_TERMS_LABELS,
  VENDOR_STATUS_LABELS,
} from "@/lib/vendor-types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

type VendorFormInput = Vendor | VendorDetailDto;

type VendorFormDialogProps = {
  vendor?: VendorFormInput;
  size?: "default" | "sm";
};

function vendorPayload(fd: FormData) {
  return {
    name: String(fd.get("name") ?? ""),
    code: String(fd.get("code") ?? ""),
    phone: String(fd.get("phone") ?? ""),
    contact: String(fd.get("contact") ?? ""),
    email: String(fd.get("email") ?? ""),
    gstin: String(fd.get("gstin") ?? ""),
    address: String(fd.get("address") ?? ""),
    city: String(fd.get("city") ?? ""),
    state: String(fd.get("state") ?? ""),
    pincode: String(fd.get("pincode") ?? ""),
    notes: String(fd.get("notes") ?? ""),
    classification: String(fd.get("classification") ?? "RAW_MATERIAL") as VendorClassification,
    status: String(fd.get("status") ?? "ACTIVE") as VendorStatus,
    paymentTerms: String(fd.get("paymentTerms") ?? "NET_30") as VendorPaymentTerms,
    fssaiNumber: String(fd.get("fssaiNumber") ?? ""),
    bankName: String(fd.get("bankName") ?? ""),
    bankAccount: String(fd.get("bankAccount") ?? ""),
    bankIfsc: String(fd.get("bankIfsc") ?? ""),
    fpoRegion: String(fd.get("fpoRegion") ?? ""),
    seasonalNotes: String(fd.get("seasonalNotes") ?? ""),
    isFpoPartner: fd.get("isFpoPartner") === "on",
    moistureLimitPct: fd.get("moistureLimitPct") ? Number(fd.get("moistureLimitPct")) : undefined,
    qualityScore: fd.get("qualityScore") ? Number(fd.get("qualityScore")) : undefined,
    deliveryScore: fd.get("deliveryScore") ? Number(fd.get("deliveryScore")) : undefined,
  };
}

export function VendorFormDialog({ vendor, size = "default" }: VendorFormDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const isEdit = Boolean(vendor);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {isEdit ? (
          <Button variant="ghost" size="sm">
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
        ) : (
          <Button size={size}>
            <Plus className="h-4 w-4" />
            Add vendor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit vendor" : "New vendor"}</DialogTitle>
          <DialogDescription>
            Supplier profile with classification, payment terms, and food industry compliance.
          </DialogDescription>
        </DialogHeader>
        <form
          className="space-y-4"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const form = e.currentTarget;
            const fd = new FormData(form);
            const payload = vendorPayload(fd);

            const result =
              isEdit && vendor ? await updateVendor(vendor.id, payload) : await createVendor(payload);

            if (!result.ok) {
              toast.error(result.error);
              setLoading(false);
              return;
            }

            toast.success(isEdit ? "Vendor updated" : "Vendor added");
            if (!isEdit) form.reset();
            setOpen(false);
            router.refresh();
            setLoading(false);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name *" name="name" required defaultValue={vendor?.name} />
            <Field label="Vendor code" name="code" defaultValue={vendor?.code ?? ""} />
            <SelectField
              label="Classification"
              name="classification"
              defaultValue={vendor?.classification ?? "RAW_MATERIAL"}
              options={Object.values(VendorClassification).map((c) => ({
                value: c,
                label: VENDOR_CLASSIFICATION_LABELS[c],
              }))}
            />
            <SelectField
              label="Status"
              name="status"
              defaultValue={vendor?.status ?? "ACTIVE"}
              options={Object.values(VendorStatus).map((s) => ({
                value: s,
                label: VENDOR_STATUS_LABELS[s],
              }))}
            />
            <Field label="Contact person" name="contact" defaultValue={vendor?.contact ?? ""} />
            <Field label="Phone" name="phone" type="tel" defaultValue={vendor?.phone ?? ""} />
            <Field label="Email" name="email" type="email" defaultValue={vendor?.email ?? ""} />
            <Field label="GSTIN" name="gstin" defaultValue={vendor?.gstin ?? ""} placeholder="22AAAAA0000A1Z5" />
            <Field label="FSSAI number" name="fssaiNumber" defaultValue={vendor?.fssaiNumber ?? ""} />
            <SelectField
              label="Payment terms"
              name="paymentTerms"
              defaultValue={vendor?.paymentTerms ?? "NET_30"}
              options={Object.values(VendorPaymentTerms).map((t) => ({
                value: t,
                label: VENDOR_PAYMENT_TERMS_LABELS[t],
              }))}
            />
          </div>

          <Field label="Address" name="address" defaultValue={vendor?.address ?? ""} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="City" name="city" defaultValue={vendor?.city ?? ""} />
            <Field label="State" name="state" defaultValue={vendor?.state ?? ""} />
            <Field label="PIN code" name="pincode" defaultValue={vendor?.pincode ?? ""} />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Bank name" name="bankName" defaultValue={vendor?.bankName ?? ""} />
            <Field label="Account number" name="bankAccount" defaultValue={vendor?.bankAccount ?? ""} />
            <Field label="IFSC" name="bankIfsc" defaultValue={vendor?.bankIfsc ?? ""} />
          </div>

          <div className="rounded-lg border border-border/60 p-3">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                name="isFpoPartner"
                defaultChecked={vendor?.isFpoPartner ?? false}
                className="h-4 w-4 rounded"
              />
              FPO / farmer partner
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Field label="FPO region" name="fpoRegion" defaultValue={vendor?.fpoRegion ?? ""} />
              <Field
                label="Moisture limit (%)"
                name="moistureLimitPct"
                type="number"
                step="0.1"
                defaultValue={vendor?.moistureLimitPct != null ? String(vendor.moistureLimitPct) : "12"}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field
              label="Quality score (%)"
              name="qualityScore"
              type="number"
              min="0"
              max="100"
              defaultValue={vendor?.qualityScore != null ? String(vendor.qualityScore) : ""}
            />
            <Field
              label="Delivery score (%)"
              name="deliveryScore"
              type="number"
              min="0"
              max="100"
              defaultValue={vendor?.deliveryScore != null ? String(vendor.deliveryScore) : ""}
            />
          </div>

          <div>
            <Label htmlFor="vendor-seasonal">Seasonal procurement notes</Label>
            <Textarea
              id="vendor-seasonal"
              name="seasonalNotes"
              className="mt-1.5"
              rows={2}
              defaultValue={vendor?.seasonalNotes ?? ""}
            />
          </div>
          <div>
            <Label htmlFor="vendor-notes">Notes</Label>
            <Textarea id="vendor-notes" name="notes" className="mt-1.5" rows={2} defaultValue={vendor?.notes ?? ""} />
          </div>

          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : isEdit ? "Save changes" : "Save vendor"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  name,
  defaultValue,
  type = "text",
  required,
  placeholder,
  min,
  max,
  step,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: string;
  max?: string;
  step?: string;
}) {
  return (
    <div>
      <Label htmlFor={`vendor-${name}`}>{label}</Label>
      <Input
        id={`vendor-${name}`}
        name={name}
        type={type}
        required={required}
        placeholder={placeholder}
        min={min}
        max={max}
        step={step}
        className="mt-1.5"
        defaultValue={defaultValue}
      />
    </div>
  );
}

function SelectField({
  label,
  name,
  defaultValue,
  options,
}: {
  label: string;
  name: string;
  defaultValue: string;
  options: { value: string; label: string }[];
}) {
  return (
    <div>
      <Label htmlFor={`vendor-${name}`}>{label}</Label>
      <select
        id={`vendor-${name}`}
        name={name}
        defaultValue={defaultValue}
        className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background px-3 text-sm"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}

/** @deprecated Use VendorFormDialog — kept for existing imports */
export const AddVendorDialog = VendorFormDialog;
