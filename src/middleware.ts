import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { handleAuthApiCors } from "@/lib/erp-portal-cors";

const { auth } = NextAuth(authConfig);

/** Edge-safe middleware — no Prisma (see auth.ts for credentials provider). */
export default auth((request) => {
  const corsResponse = handleAuthApiCors(request);
  if (corsResponse) return corsResponse;
});

export const config = {
  matcher: [
    "/api/auth/:path*",
    "/((?!api/v1/hr/biometric/webhook|iclock|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
