import Link from "next/link";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import {
  CustomerRiskBadge,
  CustomerSegmentBadge,
  CustomerStatusBadge,
  HighValueBadge,
} from "@/components/customers/customer-badges";
import { CustomerCommunications } from "@/components/customers/customer-communications";
import { CustomerDocuments } from "@/components/customers/customer-documents";
import {
  CustomerFinancialPanel,
  CustomerFoodIntelligence,
  CustomerLedgerPanel,
  CustomerPortalPanel,
} from "@/components/customers/customer-panels";
import { CustomerQuickActions } from "@/components/customers/customer-quick-actions";
import { CustomerSupportTickets } from "@/components/customers/customer-tickets";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  getCustomerById,
  getCustomerLedger,
  getCustomerOverdueInvoices,
  getCustomerPaymentHistory,
} from "@/lib/customer-metrics";
import { formatDate, formatInr } from "@/lib/utils";
import { requirePermission } from "@/lib/session";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  await requirePermission("sales.view");
  const { id } = await params;
  const sp = await searchParams;

  const customer = await getCustomerById(id);
  if (!customer) notFound();

  const [communications, documents, tickets, ledger, overdue, payments] = await Promise.all([
    prisma.customerCommunication.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { user: { select: { name: true } } },
    }),
    prisma.customerDocument.findMany({ where: { customerId: id }, orderBy: { uploadedAt: "desc" } }),
    prisma.customerSupportTicket.findMany({ where: { customerId: id }, orderBy: { createdAt: "desc" } }),
    getCustomerLedger(id),
    getCustomerOverdueInvoices(id),
    getCustomerPaymentHistory(id),
  ]);

  const initials = customer.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const showLedger = sp.tab === "ledger";

  return (
    <div className="space-y-6">
      <PageHeader
        title={customer.name}
        description={[customer.company, customer.phone, customer.email].filter(Boolean).join(" · ")}
        action={{ label: "Back to customers", href: "/customers" }}
      />

      <div className="erp-kpi-card flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <Avatar className="h-14 w-14 border-2 border-[#B68D40]/30">
            <AvatarFallback className="bg-gradient-to-br from-[#1E3A5F] to-[#2A4A6F] text-lg font-bold text-white">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex flex-wrap gap-2">
              <CustomerSegmentBadge segment={customer.segment} />
              <CustomerStatusBadge status={customer.status} />
              <CustomerRiskBadge risk={customer.creditRisk} />
              {customer.isHighValue && <HighValueBadge />}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {customer.invoiceCount} invoices · {customer.orderCount} orders · LTV {formatInr(customer.lifetimeValue)}
            </p>
          </div>
        </div>
        <div className="flex gap-2 text-sm">
          <Link
            href={`/customers/${id}`}
            className={`rounded-lg px-3 py-1.5 ${!showLedger ? "bg-[#B68D40]/15 font-semibold text-[#967235]" : "text-muted-foreground hover:bg-muted"}`}
          >
            Overview
          </Link>
          <Link
            href={`/customers/${id}?tab=ledger`}
            className={`rounded-lg px-3 py-1.5 ${showLedger ? "bg-[#B68D40]/15 font-semibold text-[#967235]" : "text-muted-foreground hover:bg-muted"}`}
          >
            Ledger
          </Link>
        </div>
      </div>

      <CustomerQuickActions customer={customer} />

      {showLedger ? (
        <CustomerLedgerPanel ledger={ledger} />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
          <div className="space-y-6">
            <CustomerFinancialPanel customer={customer} overdueInvoices={overdue} />

            <div className="erp-kpi-card p-5">
              <h3 className="text-sm font-semibold">Contact persons</h3>
              <ul className="mt-3 space-y-2">
                {customer.contacts.length === 0 ? (
                  <li className="text-xs text-muted-foreground">No contacts on file</li>
                ) : (
                  customer.contacts.map((c) => (
                    <li key={c.id} className="rounded-lg border border-border/50 px-3 py-2 text-sm">
                      <span className="font-medium">{c.name}</span>
                      {c.isPrimary && (
                        <span className="ml-2 rounded bg-[#B68D40]/15 px-1.5 py-0.5 text-[10px] font-semibold text-[#967235]">
                          Primary
                        </span>
                      )}
                      {c.title && <p className="text-xs text-muted-foreground">{c.title}</p>}
                      <p className="text-xs">{c.phone ?? c.email ?? "—"}</p>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <div className="erp-kpi-card p-5">
              <h3 className="text-sm font-semibold">Addresses</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {customer.addresses.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    {customer.address
                      ? `Billing: ${customer.address}${customer.city ? `, ${customer.city}` : ""}`
                      : "No structured addresses — using legacy address field"}
                  </p>
                ) : (
                  customer.addresses.map((a) => (
                    <div key={a.id} className="rounded-lg bg-muted/40 p-3 text-sm">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {a.type} {a.label ? `· ${a.label}` : ""}
                      </p>
                      <p className="mt-1">{a.line1}</p>
                      {a.line2 && <p>{a.line2}</p>}
                      <p className="text-muted-foreground">
                        {[a.city, a.state, a.pincode, a.country].filter(Boolean).join(", ")}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>

            <CustomerFoodIntelligence customer={customer} />
            <CustomerCommunications customerId={id} items={communications} />
            <CustomerDocuments customerId={id} documents={documents} />
          </div>

          <div className="space-y-6 xl:sticky xl:top-4 xl:self-start">
            <CustomerPortalPanel customer={customer} />

            <div className="erp-kpi-card p-5">
              <h3 className="text-sm font-semibold">Payment history</h3>
              <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto">
                {payments.length === 0 ? (
                  <li className="text-xs text-muted-foreground">No payments recorded</li>
                ) : (
                  payments.map((p) => (
                    <li key={p.id} className="flex justify-between text-xs">
                      <span>{p.sale?.invoiceNumber ?? "—"}</span>
                      <span className="font-semibold text-emerald-700">{formatInr(Number(p.amount))}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>

            <CustomerSupportTickets customerId={id} tickets={tickets} />

            <div className="erp-kpi-card p-5 text-xs text-muted-foreground">
              <p>Customer since {formatDate(new Date(customer.createdAt))}</p>
              {customer.gstin && <p className="mt-1 font-mono">GSTIN: {customer.gstin}</p>}
              {customer.country && <p className="mt-1">Country: {customer.country}</p>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
