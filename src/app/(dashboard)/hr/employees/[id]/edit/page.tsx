import { notFound } from "next/navigation";
import { HrPageHeader } from "@/components/hr/hr-page-header";
import { EmployeeFormClient } from "@/components/hr/employee-form-client";
import { getEmployee } from "@/lib/hr/employee-store";

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  return (
    <>
      <HrPageHeader title="Edit employee" description={employee.name} />
      <EmployeeFormClient employee={employee} />
    </>
  );
}
