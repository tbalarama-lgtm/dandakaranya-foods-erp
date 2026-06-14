import Link from "next/link";
import { HrPageHeader } from "@/components/hr/hr-page-header";
import { EmployeesListClient } from "@/components/hr/employees-list-client";
import { listEmployees } from "@/lib/hr/employee-store";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";

export default async function EmployeesPage() {
  const employees = await listEmployees();
  return (
    <>
      <HrPageHeader
        title="Employee management"
        description="Full employee database — add, edit, search, export, and profile views."
        actions={
          <Button asChild size="sm">
            <Link href="/hr/employees/new">
              <UserPlus className="mr-2 h-4 w-4" />
              Add employee
            </Link>
          </Button>
        }
      />
      <EmployeesListClient initial={employees} />
    </>
  );
}
