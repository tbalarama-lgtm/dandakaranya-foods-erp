import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { authConfig, SESSION_MAX_AGE } from "./auth.config";
import { prisma } from "@/lib/db";
import { logActivity } from "@/lib/activity";
import { tryDevLogin } from "@/lib/dev-auth";
import { ActivityAction } from "@prisma/client";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;
        const normalizedEmail = email.toLowerCase();

        try {
          const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });

          if (!user || !user.active) {
            await logActivity({
              action: ActivityAction.LOGIN_FAILED,
              entityType: "User",
              message: `Failed login attempt for ${email}`,
              metadata: { email },
            }).catch(() => undefined);
            return tryDevLogin(email, password);
          }

          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid) {
            await logActivity({
              action: ActivityAction.LOGIN_FAILED,
              entityType: "User",
              entityId: user.id,
              message: `Invalid password for ${email}`,
            }).catch(() => undefined);
            return null;
          }

          await prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
          });

          await logActivity({
            userId: user.id,
            userName: user.name,
            action: ActivityAction.LOGIN,
            entityType: "User",
            entityId: user.id,
            message: `${user.name} signed in`,
          }).catch(() => undefined);

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            sessionVersion: user.sessionVersion,
          };
        } catch (error) {
          console.error("[auth] Database unavailable, trying dev login:", error);
          return tryDevLogin(email, password);
        }
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
});
