import { apiHandler, jsonOk } from "@/lib/api/handler";
import { prisma } from "@/lib/db";

export const GET = apiHandler(
  async () => {
    const [employees, attendance, leaves, payrolls] = await Promise.all([
      prisma.employee.findMany({ where: { active: true }, include: { branch: true } }),
      prisma.attendance.findMany({ take: 30, orderBy: { date: "desc" } }),
      prisma.leaveRequest.findMany({ take: 20, orderBy: { createdAt: "desc" } }),
      prisma.payrollRun.findMany({ take: 12, orderBy: { createdAt: "desc" } }),
    ]);
    return jsonOk({ employees, attendance, leaves, payrolls });
  },
  { permission: "hr.view" },
);
