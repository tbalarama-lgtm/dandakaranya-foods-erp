import { HrPageHeader } from "@/components/hr/hr-page-header";
import { HolidaysClient } from "@/components/hr/shifts-holidays-client";
import { MOCK_HOLIDAYS } from "@/lib/hr/mock-data";

export default function HolidaysPage() {
  return (
    <>
      <HrPageHeader title="Holiday calendar" description="National, regional, and company holidays." />
      <HolidaysClient holidays={MOCK_HOLIDAYS} />
    </>
  );
}
