import type { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

/** Dev-only fallback when DATABASE_URL is unreachable (see auth.ts). */
export function tryDevLogin(email: string, password: string) {
  if (process.env.NODE_ENV === "production") return null;

  const devEmail = process.env.DEV_LOGIN_EMAIL ?? "admin@dandakaranyafoods.com";
  const devPassword = process.env.DEV_LOGIN_PASSWORD ?? "Admin@2026";

  if (email.toLowerCase() !== devEmail.toLowerCase() || password !== devPassword) {
    return null;
  }

  return {
    id: "dev-admin",
    email: devEmail,
    name: "Admin (dev)",
    role: "ADMIN" as UserRole,
    sessionVersion: 0,
  };
}

export async function tryDevLoginWithHash(email: string, password: string, passwordHash: string) {
  const devEmail = process.env.DEV_LOGIN_EMAIL ?? "admin@dandakaranyafoods.com";
  if (email.toLowerCase() !== devEmail.toLowerCase()) return null;
  const valid = await bcrypt.compare(password, passwordHash);
  if (!valid) return null;
  return tryDevLogin(email, password);
}
