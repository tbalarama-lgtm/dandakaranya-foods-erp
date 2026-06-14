import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { auth } from "@/auth";
import { Providers } from "@/components/providers/providers";
import { ThemeScript } from "@/components/providers/theme-script";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Dandakaranya Foods ERP",
  description: "Enterprise resource planning for sales, inventory, and CRM",
  robots: { index: false, follow: false },
};

/** Desktop-first ERP — avoid narrow/mobile layout in the browser. */
export const viewport: Viewport = {
  width: 1280,
  initialScale: 1,
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en" suppressHydrationWarning className={inter.variable}>
      <body className="font-sans" suppressHydrationWarning>
        <ThemeScript />
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
