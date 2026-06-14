import { HrPageHeader } from "@/components/hr/hr-page-header";
import { EmployeeFormClient } from "@/components/hr/employee-form-client";

export default function NewEmployeePage() {
  return (
    <>
      <HrPageHeader title="Add employee" description="Create a new employee record in the directory." />
      <EmployeeFormClient />
    </>
  );
}
