import type { UserRole } from "@prisma/client";
import type { NextAuthConfig } from "next-auth";

export const SESSION_MAX_AGE = 8 * 60 * 60; // 8 hours

export const authConfig = {
  trustHost: true,
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: SESSION_MAX_AGE,
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isLogin = nextUrl.pathname.startsWith("/login");
      const isAuthApi = nextUrl.pathname.startsWith("/api/auth");

      if (isAuthApi) return true;
      if (isLogin) return isLoggedIn ? Response.redirect(new URL("/", nextUrl)) : true;
      return isLoggedIn;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.sessionVersion = user.sessionVersion;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as UserRole;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
