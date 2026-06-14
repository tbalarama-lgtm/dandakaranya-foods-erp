import { HrPageHeader } from "@/components/hr/hr-page-header";
import { ShiftsClient } from "@/components/hr/shifts-holidays-client";
import { MOCK_SHIFTS } from "@/lib/hr/mock-data";

export default function ShiftsPage() {
  return (
    <>
      <HrPageHeader title="Shift scheduling" description="Manage shifts and employee assignments by branch." />
      <ShiftsClient shifts={MOCK_SHIFTS} />
    </>
  );
}
