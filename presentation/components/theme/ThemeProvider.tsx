"use client";

/**
 * Shares the current light/dark theme and saves a chosen preference.
 * It preserves the theme set before hydration and tolerates blocked browser storage.
 */

import { createContext, useContext, useEffect, useState } from "react";

type Theme = "light" | "dark";
type ThemeContextValue = { theme: Theme; toggleTheme: () => void };
const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("light");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let resolvedTheme: Theme = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    try {
      const savedTheme = window.localStorage.getItem("ladles-theme");
      resolvedTheme = savedTheme === 'dark' || savedTheme === 'light' ? savedTheme : window.matchMedia("(prefers-color-scheme: dark)").matches ? 'dark' : 'light';
    } catch { /* Keep the existing page theme if browser storage is blocked. */ }
    let active = true;
    queueMicrotask(() => { if (active) { setTheme(resolvedTheme); setReady(true); } });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.dataset.theme = theme;
    try { window.localStorage.setItem("ladles-theme", theme); } catch { /* Theme changes still work without persistence. */ }
  }, [theme, ready]);

  return <ThemeContext.Provider value={{ theme, toggleTheme: () => setTheme((current) => current === "dark" ? "light" : "dark") }}>{children}</ThemeContext.Provider>;
}

/**
 * Read the shared theme context so switches act on one document-level theme.
 */
export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used inside ThemeProvider");
  return context;
}
