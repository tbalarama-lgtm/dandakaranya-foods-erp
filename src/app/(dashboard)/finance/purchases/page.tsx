import { FinancePageHeader } from "@/components/finance/finance-page-header";
import { FinancePurchasesClient } from "@/components/finance/finance-purchases-client";
import { MOCK_PURCHASES } from "@/lib/finance/mock-data";

export default function FinancePurchasesPage() {
  return (
    <>
      <FinancePageHeader
        title="Purchase management"
        description="Purchase orders, vendor ledger, approvals, GRN, and supplier payments."
      />
      <FinancePurchasesClient purchases={MOCK_PURCHASES} />
    </>
  );
}
