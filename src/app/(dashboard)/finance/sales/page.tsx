import { FinancePageHeader } from "@/components/finance/finance-page-header";
import { FinanceSalesClient } from "@/components/finance/finance-sales-client";
import { MOCK_SALES_INVOICES } from "@/lib/finance/mock-data";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function FinanceSalesPage() {
  return (
    <>
      <FinancePageHeader
        title="Sales management"
        description="Invoices, customer ledger, payment tracking, tax, and sales returns."
        actions={
          <Button asChild size="sm">
            <Link href="/sales">Open sales module</Link>
          </Button>
        }
      />
      <FinanceSalesClient invoices={MOCK_SALES_INVOICES} />
    </>
  );
}
