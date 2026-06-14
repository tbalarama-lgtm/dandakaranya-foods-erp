import { HrPageHeader } from "@/components/hr/hr-page-header";
import { AttendanceClient } from "@/components/hr/attendance-client";
import { MOCK_ATTENDANCE } from "@/lib/hr/mock-data";

export default function AttendancePage() {
  return (
    <>
      <HrPageHeader
        title="Attendance management"
        description="Daily attendance, clock in/out, late marks, overtime, calendar, and reports."
      />
      <AttendanceClient records={MOCK_ATTENDANCE} />
    </>
  );
}
