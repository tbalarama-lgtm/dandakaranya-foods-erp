import { HrPageHeader } from "@/components/hr/hr-page-header";
import { LeaveClient } from "@/components/hr/leave-client";
import { MOCK_LEAVE_BALANCES, MOCK_LEAVE_REQUESTS } from "@/lib/hr/mock-data";

export default function LeavePage() {
  return (
    <>
      <HrPageHeader
        title="Leave management"
        description="Sick, casual, and paid leave — requests, approvals, balances, and history."
      />
      <LeaveClient requests={MOCK_LEAVE_REQUESTS} balances={MOCK_LEAVE_BALANCES} />
    </>
  );
}
