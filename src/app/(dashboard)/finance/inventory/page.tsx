import { FinancePageHeader } from "@/components/finance/finance-page-header";
import { FinanceInventoryClient } from "@/components/finance/finance-inventory-client";

export default function FinanceInventoryPage() {
  return (
    <>
      <FinancePageHeader
        title="Inventory finance"
        description="Stock valuation, costing, raw material costs, and product profitability."
      />
      <FinanceInventoryClient />
    </>
  );
}
