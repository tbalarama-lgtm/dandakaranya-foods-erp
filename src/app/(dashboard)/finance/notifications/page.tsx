import { FinancePageHeader } from "@/components/finance/finance-page-header";
import { FinanceNotificationsClient } from "@/components/finance/finance-notifications-client";
import { MOCK_FINANCE_NOTIFICATIONS } from "@/lib/finance/mock-data";

export default function FinanceNotificationsPage() {
  return (
    <>
      <FinancePageHeader
        title="Finance alerts"
        description="Pending payments, due invoices, GST deadlines, budget overruns, and cash flow warnings."
      />
      <FinanceNotificationsClient items={MOCK_FINANCE_NOTIFICATIONS} />
    </>
  );
}
