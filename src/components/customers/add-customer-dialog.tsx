"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { CustomerSegment } from "@prisma/client";
import { createCustomer } from "@/actions/customers";
import { CUSTOMER_SEGMENT_LABELS } from "@/lib/customer-types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

export function AddCustomerDialog() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4" />
          Add customer
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New customer</DialogTitle>
          <DialogDescription>Add a buyer for invoices and repeat orders.</DialogDescription>
        </DialogHeader>
        <form
          className="space-y-3"
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            const fd = new FormData(e.currentTarget);
            try {
              await createCustomer({
                name: String(fd.get("name")),
                phone: String(fd.get("phone")),
                company: String(fd.get("company") || ""),
                email: String(fd.get("email") || ""),
                gstin: String(fd.get("gstin") || ""),
                city: String(fd.get("city") || ""),
                state: String(fd.get("state") || ""),
                segment: (fd.get("segment") as CustomerSegment) || "RETAIL",
              });
              toast.success("Customer added");
              setOpen(false);
              router.refresh();
            } catch {
              toast.error("Could not add customer");
            } finally {
              setLoading(false);
            }
          }}
        >
          <div>
            <Label htmlFor="cust-name">Name *</Label>
            <Input id="cust-name" name="name" required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="cust-phone">Phone *</Label>
            <Input id="cust-phone" name="phone" required className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="cust-company">Company</Label>
            <Input id="cust-company" name="company" className="mt-1.5" />
          </div>
          <div>
            <Label htmlFor="cust-email">Email</Label>
            <Input id="cust-email" name="email" type="email" className="mt-1.5" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="cust-gstin">GSTIN</Label>
              <Input id="cust-gstin" name="gstin" className="mt-1.5" />
            </div>
            <div>
              <Label htmlFor="cust-city">City</Label>
              <Input id="cust-city" name="city" className="mt-1.5" />
            </div>
          </div>
          <div>
            <Label htmlFor="cust-segment">Segment</Label>
            <select id="cust-segment" name="segment" className="mt-1.5 flex h-10 w-full rounded-lg border border-border px-3 text-sm">
              {Object.values(CustomerSegment).map((s) => (
                <option key={s} value={s}>
                  {CUSTOMER_SEGMENT_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving…" : "Save customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
