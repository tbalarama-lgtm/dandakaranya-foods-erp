"use client";

import Link from "next/link";
import {
  BookOpen,
  FileText,
  Mail,
  Phone,
  Receipt,
  ShoppingCart,
  MessageCircle,
} from "lucide-react";
import type { CustomerDetailDto } from "@/lib/customer-types";
import { Button } from "@/components/ui/button";
import { ICON_STROKE } from "@/lib/enterprise-ui";

export function CustomerQuickActions({ customer }: { customer: CustomerDetailDto }) {
  return (
    <div className="erp-kpi-card flex flex-wrap gap-2 p-4">
      <Button type="button" size="sm" variant="secondary" asChild>
        <a href={`tel:${customer.phone}`}>
          <Phone className="h-4 w-4" strokeWidth={ICON_STROKE} />
          Call
        </a>
      </Button>
      {customer.email && (
        <Button type="button" size="sm" variant="secondary" asChild>
          <a href={`mailto:${customer.email}`}>
            <Mail className="h-4 w-4" strokeWidth={ICON_STROKE} />
            Email
          </a>
        </Button>
      )}
      <Button type="button" size="sm" variant="secondary" asChild>
        <a href={`https://wa.me/${customer.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
          <MessageCircle className="h-4 w-4" strokeWidth={ICON_STROKE} />
          WhatsApp
        </a>
      </Button>
      <Button type="button" size="sm" variant="premium" asChild>
        <Link href={`/quotations/new?customerId=${customer.id}`}>
          <FileText className="h-4 w-4" strokeWidth={ICON_STROKE} />
          Create quotation
        </Link>
      </Button>
      <Button type="button" size="sm" variant="secondary" asChild>
        <Link href={`/sales/new?customerId=${customer.id}`}>
          <Receipt className="h-4 w-4" strokeWidth={ICON_STROKE} />
          Create invoice
        </Link>
      </Button>
      <Button type="button" size="sm" variant="secondary" asChild>
        <Link href={`/sales/new?customerId=${customer.id}`}>
          <ShoppingCart className="h-4 w-4" strokeWidth={ICON_STROKE} />
          Sales order
        </Link>
      </Button>
      <Button type="button" size="sm" variant="outline" asChild>
        <Link href={`/customers/${customer.id}?tab=ledger`}>
          <BookOpen className="h-4 w-4" strokeWidth={ICON_STROKE} />
          View ledger
        </Link>
      </Button>
    </div>
  );
}
