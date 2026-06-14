import { FinancePageHeader } from "@/components/finance/finance-page-header";
import { FinanceGstClient } from "@/components/finance/finance-gst-client";
import { MOCK_GST } from "@/lib/finance/mock-data";

export default function FinanceGstPage() {
  return (
    <>
      <FinancePageHeader
        title="GST & taxation"
        description="GST calculation, ITC, output tax, filing reminders, and TDS placeholders."
      />
      <FinanceGstClient gst={MOCK_GST} />
    </>
  );
}
