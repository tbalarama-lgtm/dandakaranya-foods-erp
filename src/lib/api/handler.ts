import { NextResponse } from "next/server";
import { auth } from "@/auth";
import type { UserRole } from "@prisma/client";
import { can, type Permission } from "@/lib/rbac";

export type ApiContext = {
  user: { id: string; email: string; name: string; role: UserRole };
};

type Handler = (ctx: ApiContext, request: Request) => Promise<Response>;

export function apiHandler(handler: Handler, options?: { permission?: Permission; roles?: UserRole[] }) {
  return async (request: Request) => {
    try {
      const session = await auth();
      if (!session?.user?.id) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }

      const user = {
        id: session.user.id,
        email: session.user.email ?? "",
        name: session.user.name ?? "",
        role: session.user.role as UserRole,
      };

      if (options?.roles && !options.roles.includes(user.role)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      if (options?.permission && !can(user.role, options.permission)) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      return await handler({ user }, request);
    } catch (e) {
      console.error("[API]", e);
      return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}

export function jsonOk<T>(data: T, status = 200) {
  return NextResponse.json({ success: true, data }, { status });
}
