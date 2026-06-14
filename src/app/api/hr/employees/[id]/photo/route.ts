import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { can } from "@/lib/rbac";
import { saveEmployeePhotoFile } from "@/lib/hr/employee-photos";
import { getEmployee, saveEmployee } from "@/lib/hr/employee-store";

export const runtime = "nodejs";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session?.user || !can(session.user.role, "hr.manage")) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const employee = await getEmployee(id);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const formData = await req.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const { photoUrl } = await saveEmployeePhotoFile(id, file);
    await saveEmployee({ ...employee, photoUrl });

    return NextResponse.json({ photoUrl });
  } catch (err) {
    console.error("[employee-photo-upload]", err);
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : "Failed to upload photo",
      },
      { status: 500 },
    );
  }
}
