"use client";

import Link from "next/link";
import { FileText, ShoppingCart, ShieldCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { VendorFormDialog } from "@/components/vendors/add-vendor-dialog";
import type { VendorDetailDto } from "@/lib/vendor-types";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export function VendorQuickActions({ vendor }: { vendor: VendorDetailDto }) {
  return (
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" variant="premium" asChild>
        <Link href={`/purchases/new?vendorId=${vendor.id}`}>
          <ShoppingCart className="mr-1.5 h-4 w-4" strokeWidth={ICON_STROKE} />
          Create PO
        </Link>
      </Button>
      <Button type="button" size="sm" variant="secondary" asChild>
        <Link href={`/procurement/rfq?vendorId=${vendor.id}`}>
          <FileText className="mr-1.5 h-4 w-4" strokeWidth={ICON_STROKE} />
          Send RFQ
        </Link>
      </Button>
      <Button type="button" size="sm" variant="secondary" asChild>
        <Link href={`/vendors/${vendor.id}?tab=compliance`}>
          <ShieldCheck className="mr-1.5 h-4 w-4" strokeWidth={ICON_STROKE} />
          Compliance
        </Link>
      </Button>
      {vendor.status === "PREFERRED" && (
        <span className="inline-flex items-center gap-1 rounded-lg bg-[#B68D40]/12 px-3 py-1.5 text-xs font-semibold text-[#967235]">
          <Star className="h-3.5 w-3.5" />
          Preferred supplier
        </span>
      )}
      <VendorFormDialog vendor={vendor} size="sm" />
    </div>
  );
}
