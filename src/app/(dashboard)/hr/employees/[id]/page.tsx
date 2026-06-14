import { notFound } from "next/navigation";
import { HrPageHeader } from "@/components/hr/hr-page-header";
import { EmployeeProfileClient } from "@/components/hr/employee-profile-client";
import { getEmployee } from "@/lib/hr/employee-store";

export default async function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const employee = await getEmployee(id);
  if (!employee) notFound();

  return (
    <>
      <HrPageHeader title={employee.name} description={`${employee.designation} · ${employee.department}`} />
      <EmployeeProfileClient employee={employee} />
    </>
  );
}
