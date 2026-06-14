"use client";

import { useRouter } from "next/navigation";
import { LeadPriority, LeadSource, LeadStage } from "@prisma/client";
import { createLead } from "@/actions/leads";
import { CRM_SOURCE_LABELS, CRM_STAGE_LABELS } from "@/lib/crm-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export function LeadForm({ assignees }: { assignees: { id: string; name: string }[] }) {
  const router = useRouter();

  return (
    <form
      className="erp-kpi-card grid max-w-3xl gap-4 p-6 sm:grid-cols-2"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        try {
          await createLead({
            company: String(fd.get("company")),
            contactName: String(fd.get("contactName")),
            phone: String(fd.get("phone")),
            email: String(fd.get("email") || ""),
            stage: (fd.get("stage") as LeadStage) || LeadStage.NEW,
            priority: (fd.get("priority") as LeadPriority) || LeadPriority.MEDIUM,
            leadSource: (fd.get("leadSource") as LeadSource) || undefined,
            products: String(fd.get("products") || ""),
            volume: String(fd.get("volume") || ""),
            value: Number(fd.get("value") || 0) || undefined,
            country: String(fd.get("country") || ""),
            moq: String(fd.get("moq") || ""),
            packagingPreference: String(fd.get("packagingPreference") || ""),
            shippingTerms: String(fd.get("shippingTerms") || ""),
            certifications: String(fd.get("certifications") || ""),
            distributorName: String(fd.get("distributorName") || ""),
            productCategories: String(fd.get("productCategories") || ""),
            assigneeId: String(fd.get("assigneeId") || ""),
            followUpAt: String(fd.get("followUpAt") || ""),
            message: String(fd.get("message") || ""),
          });
          toast.success("Lead created");
          router.push("/leads");
        } catch {
          toast.error("Could not create lead");
        }
      }}
    >
      <div className="sm:col-span-2">
        <h3 className="font-semibold">Contact information</h3>
      </div>
      <div>
        <Label>Company</Label>
        <Input name="company" required className="mt-1" />
      </div>
      <div>
        <Label>Contact name</Label>
        <Input name="contactName" required className="mt-1" />
      </div>
      <div>
        <Label>Phone</Label>
        <Input name="phone" required className="mt-1" />
      </div>
      <div>
        <Label>Email</Label>
        <Input name="email" type="email" className="mt-1" />
      </div>
      <div>
        <Label>Stage</Label>
        <select name="stage" className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm">
          {Object.values(LeadStage).map((s) => (
            <option key={s} value={s}>{CRM_STAGE_LABELS[s]}</option>
          ))}
        </select>
      </div>
      <div>
        <Label>Priority</Label>
        <select name="priority" className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm">
          {Object.values(LeadPriority).map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
      </div>
      <div>
        <Label>Lead source</Label>
        <select name="leadSource" className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm">
          <option value="">—</option>
          {Object.values(LeadSource).map((s) => (
            <option key={s} value={s}>{CRM_SOURCE_LABELS[s]}</option>
          ))}
        </select>
      </div>
      <div>
        <Label>Assign to</Label>
        <select name="assigneeId" className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm">
          <option value="">Auto</option>
          {assignees.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <h3 className="font-semibold">Export & deal details</h3>
      </div>
      <div>
        <Label>Country</Label>
        <Input name="country" className="mt-1" placeholder="UAE, USA…" />
      </div>
      <div>
        <Label>Est. deal value (₹)</Label>
        <Input name="value" type="number" className="mt-1" />
      </div>
      <div>
        <Label>MOQ</Label>
        <Input name="moq" className="mt-1" />
      </div>
      <div>
        <Label>Packaging preference</Label>
        <Input name="packagingPreference" className="mt-1" placeholder="Bulk, retail packs…" />
      </div>
      <div>
        <Label>Shipping terms</Label>
        <Input name="shippingTerms" className="mt-1" placeholder="FOB, CIF…" />
      </div>
      <div>
        <Label>Certifications required</Label>
        <Input name="certifications" className="mt-1" placeholder="FSSAI, ISO, Halal…" />
      </div>
      <div>
        <Label>Distributor / agent</Label>
        <Input name="distributorName" className="mt-1" />
      </div>
      <div>
        <Label>Product categories</Label>
        <Input name="productCategories" className="mt-1" placeholder="Spices, tamarind, powders…" />
      </div>
      <div>
        <Label>Products interest</Label>
        <Input name="products" className="mt-1" />
      </div>
      <div>
        <Label>Volume</Label>
        <Input name="volume" className="mt-1" />
      </div>
      <div>
        <Label>Follow-up date</Label>
        <Input name="followUpAt" type="date" className="mt-1" />
      </div>
      <div className="sm:col-span-2">
        <Label>Notes</Label>
        <textarea name="message" rows={3} className="mt-1 w-full rounded-xl border border-border px-3 py-2 text-sm" />
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" variant="premium">Save lead</Button>
      </div>
    </form>
  );
}
