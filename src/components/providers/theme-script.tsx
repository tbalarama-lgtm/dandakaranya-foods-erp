"use client";

import { useServerInsertedHTML } from "next/navigation";
import { THEME_INIT_SCRIPT } from "@/lib/theme-init-script";

/**
 * Injects theme init before hydration via Next.js HTML stream (React 19–safe).
 * Avoids rendering <script> in the client React tree (console warning).
 */
export function ThemeScript() {
  useServerInsertedHTML(() => (
    <script
      dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
      suppressHydrationWarning
    />
  ));

  return null;
}
