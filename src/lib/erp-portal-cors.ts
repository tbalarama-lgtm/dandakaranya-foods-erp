import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const DEFAULT_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://127.0.0.1:4173",
];

/** Local marketing site ports during development (Vite, preview, etc.). */
function isLocalDevPortalOrigin(origin: string): boolean {
  if (process.env.NODE_ENV === "production") return false;
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
}

export function getErpPortalOrigins(): string[] {
  const fromEnv = [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.ERP_PORTAL_ORIGIN,
    process.env.AUTH_URL,
    process.env.NEXTAUTH_URL,
  ].filter(Boolean) as string[];

  return [...new Set([...fromEnv, ...DEFAULT_DEV_ORIGINS])];
}

export function isAllowedPortalOrigin(origin: string | null): origin is string {
  if (!origin) return false;
  if (getErpPortalOrigins().includes(origin)) return true;
  return isLocalDevPortalOrigin(origin);
}

export function isAllowedPortalReferer(referer: string): boolean {
  try {
    const url = new URL(referer);
    const origin = `${url.protocol}//${url.host}`;
    return isAllowedPortalOrigin(origin);
  } catch {
    return false;
  }
}

export function isPortalSignInRequest(origin: string | null, referer: string | null): boolean {
  if (isAllowedPortalOrigin(origin)) return true;
  if (referer && isAllowedPortalReferer(referer)) return true;
  return false;
}

export function corsHeadersForPortal(origin: string | null): HeadersInit | null {
  if (!isAllowedPortalOrigin(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Auth-Return-Redirect",
    "Vary": "Origin",
  };
}

export function handleAuthApiCors(request: NextRequest): NextResponse | null {
  if (!request.nextUrl.pathname.startsWith("/api/auth")) return null;

  const origin = request.headers.get("origin");
  const headers = corsHeadersForPortal(origin);

  if (request.method === "OPTIONS") {
    if (!headers) return new NextResponse(null, { status: 204 });
    return new NextResponse(null, { status: 204, headers });
  }

  // Same-origin auth calls don't need CORS — let NextAuth middleware handle them.
  if (!headers) return null;

  const response = NextResponse.next();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}
