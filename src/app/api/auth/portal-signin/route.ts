import { NextRequest, NextResponse } from "next/server";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";
import { isPortalSignInRequest } from "@/lib/erp-portal-cors";

export const runtime = "nodejs";

/**
 * Accepts a cross-site form POST from the marketing site (/erp/login).
 * No CSRF cookie required — origin/referer is validated instead.
 */
export async function POST(req: NextRequest) {
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  if (!isPortalSignInRequest(origin, referer)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const formData = await req.formData();
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    const login = new URL("/login", req.url);
    login.searchParams.set("error", "missing");
    return NextResponse.redirect(login);
  }

  try {
    const result = await signIn("credentials", {
      email,
      password,
      redirectTo: "/",
      redirect: false,
    });

    const target =
      typeof result === "string" && result.startsWith("http")
        ? result
        : new URL("/", req.url).toString();

    return NextResponse.redirect(target);
  } catch (error) {
    if (error instanceof AuthError) {
      const login = new URL("/login", req.url);
      login.searchParams.set("error", "CredentialsSignin");
      login.searchParams.set("email", email);
      return NextResponse.redirect(login);
    }
    console.error("[portal-signin]", error);
    const login = new URL("/login", req.url);
    login.searchParams.set("error", "server");
    return NextResponse.redirect(login);
  }
}
