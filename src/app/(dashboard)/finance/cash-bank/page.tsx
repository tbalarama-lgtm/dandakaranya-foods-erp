import { FinancePageHeader } from "@/components/finance/finance-page-header";
import { FinanceCashBankClient } from "@/components/finance/finance-cash-bank-client";
import { MOCK_BANK_ACCOUNTS, MOCK_BANK_TRANSACTIONS } from "@/lib/finance/mock-data";

export default function FinanceCashBankPage() {
  return (
    <>
      <FinancePageHeader
        title="Cash & bank management"
        description="Multi-account treasury, transfers, reconciliation, and transaction history."
      />
      <FinanceCashBankClient accounts={MOCK_BANK_ACCOUNTS} transactions={MOCK_BANK_TRANSACTIONS} />
    </>
  );
}
