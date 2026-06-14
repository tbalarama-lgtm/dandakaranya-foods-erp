import type { CustomerDetailDto } from "@/lib/customer-types";
import { formatInr } from "@/lib/utils";

export function CustomerFinancialPanel({
  customer,
  overdueInvoices,
}: {
  customer: CustomerDetailDto;
  overdueInvoices: {
    id: string;
    invoiceNumber: string;
    total: unknown;
    dueDate: Date | null;
    paymentStatus: string;
  }[];
}) {
  return (
    <div className="erp-kpi-card p-5">
      <h3 className="text-sm font-semibold">Financial summary</h3>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Lifetime value</dt>
          <dd className="text-lg font-bold text-[#B68D40]">{formatInr(customer.lifetimeValue)}</dd>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Outstanding</dt>
          <dd className={`text-lg font-bold ${customer.outstanding > 0 ? "text-amber-700" : ""}`}>
            {formatInr(customer.outstanding)}
          </dd>
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Credit limit</dt>
          <dd className="text-lg font-bold">{customer.creditLimit != null ? formatInr(customer.creditLimit) : "—"}</dd>
          {customer.creditLimit != null && (
            <p className="text-xs text-muted-foreground">{customer.creditUtilization}% utilized</p>
          )}
        </div>
        <div className="rounded-lg bg-muted/40 p-3">
          <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">Overdue invoices</dt>
          <dd className={`text-lg font-bold ${customer.overdueCount > 0 ? "text-red-600" : ""}`}>
            {customer.overdueCount}
          </dd>
        </div>
      </dl>
      {overdueInvoices.length > 0 && (
        <ul className="mt-4 space-y-2">
          {overdueInvoices.map((inv) => (
            <li key={inv.id} className="rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-sm">
              <span className="font-medium">{inv.invoiceNumber}</span>
              <span className="ml-2 text-xs text-red-600">{inv.paymentStatus}</span>
              <p className="text-xs text-muted-foreground">{formatInr(Number(inv.total))}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function CustomerLedgerPanel({
  ledger,
}: {
  ledger: {
    id: string;
    date: string;
    type: string;
    reference: string;
    debit: number;
    credit: number;
    balance: number;
    status?: string;
  }[];
}) {
  return (
    <div className="erp-kpi-card overflow-hidden p-0">
      <div className="border-b border-border/50 px-5 py-3">
        <h3 className="text-sm font-semibold">Customer ledger</h3>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-muted/80 text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left">Date</th>
              <th className="px-4 py-2 text-left">Reference</th>
              <th className="px-4 py-2 text-right">Debit</th>
              <th className="px-4 py-2 text-right">Credit</th>
              <th className="px-4 py-2 text-right">Balance</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/40">
            {ledger.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">
                  No ledger entries
                </td>
              </tr>
            ) : (
              ledger.map((row) => (
                <tr key={`${row.type}-${row.id}`}>
                  <td className="px-4 py-2 text-xs">{new Date(row.date).toLocaleDateString("en-IN")}</td>
                  <td className="px-4 py-2">
                    <span className="font-medium">{row.reference}</span>
                    <span className="ml-1 text-[10px] uppercase text-muted-foreground">{row.type}</span>
                  </td>
                  <td className="px-4 py-2 text-right">{row.debit > 0 ? formatInr(row.debit) : "—"}</td>
                  <td className="px-4 py-2 text-right text-emerald-700">
                    {row.credit > 0 ? formatInr(row.credit) : "—"}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">{formatInr(row.balance)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function CustomerFoodIntelligence({ customer }: { customer: CustomerDetailDto }) {
  const fields = [
    { label: "Packaging preferences", value: customer.packagingPreference },
    { label: "Export requirements", value: customer.exportRequirements },
    { label: "MOQ", value: customer.moq },
    { label: "Distributor territory", value: customer.distributorTerritory },
    { label: "Seasonal order patterns", value: customer.seasonalNotes },
  ];

  return (
    <div className="erp-kpi-card p-5">
      <h3 className="text-sm font-semibold">Food industry intelligence</h3>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.label} className="rounded-lg bg-muted/40 px-3 py-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{f.label}</p>
            <p className="text-sm font-medium">{f.value || "—"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CustomerPortalPanel({ customer }: { customer: CustomerDetailDto }) {
  return (
    <div className="erp-kpi-card p-5">
      <h3 className="text-sm font-semibold">Customer portal readiness</h3>
      <div className="mt-3 flex items-center gap-3">
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            customer.portalEnabled ? "bg-emerald-500/12 text-emerald-700" : "bg-muted text-muted-foreground"
          }`}
        >
          {customer.portalEnabled ? "Portal enabled" : "Portal disabled"}
        </span>
        {customer.portalEmail && (
          <span className="text-sm text-muted-foreground">{customer.portalEmail}</span>
        )}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Enable portal access for self-service order tracking, invoices, and support requests.
      </p>
    </div>
  );
}
