"use client";

import type { Session } from "next-auth";
import { SessionProvider } from "next-auth/react";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";

type ProvidersProps = {
  children: React.ReactNode;
  session: Session | null;
};

export function Providers({ children, session }: ProvidersProps) {
  return (
    <SessionProvider session={session} refetchOnWindowFocus={false}>
      <ThemeProvider>
        {children}
        <Toaster richColors position="top-right" closeButton />
      </ThemeProvider>
    </SessionProvider>
  );
}
