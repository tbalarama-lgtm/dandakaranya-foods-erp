"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

const STORAGE_KEY = "theme";

type ResolvedTheme = "light" | "dark";

type ThemeContextValue = {
  theme?: string;
  resolvedTheme?: ResolvedTheme;
  setTheme: (theme: string) => void;
  themes: string[];
};

const ThemeContext = createContext<ThemeContextValue>({
  setTheme: () => {},
  themes: ["light", "dark", "system"],
});

function resolveTheme(theme: string): ResolvedTheme {
  if (theme === "dark") return "dark";
  if (theme === "light") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved: ResolvedTheme) {
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(resolved);
  root.style.colorScheme = resolved;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<string>();
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>();

  useLayoutEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY) || "system";
    const resolved = resolveTheme(stored);
    setThemeState(stored);
    setResolvedTheme(resolved);
    applyTheme(resolved);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemChange = () => {
      const current = localStorage.getItem(STORAGE_KEY) || "system";
      if (current === "system") {
        const next = resolveTheme("system");
        setResolvedTheme(next);
        applyTheme(next);
      }
    };
    mq.addEventListener("change", onSystemChange);
    return () => mq.removeEventListener("change", onSystemChange);
  }, []);

  const setTheme = useCallback((next: string) => {
    localStorage.setItem(STORAGE_KEY, next);
    setThemeState(next);
    const resolved = resolveTheme(next);
    setResolvedTheme(resolved);
    applyTheme(resolved);
  }, []);

  const value = useMemo(
    () => ({ theme, resolvedTheme, setTheme, themes: ["light", "dark", "system"] }),
    [theme, resolvedTheme, setTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  return useContext(ThemeContext);
}
