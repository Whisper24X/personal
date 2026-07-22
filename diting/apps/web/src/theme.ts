import { useCallback, useState } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "titing.theme";

export function resolveInitialTheme(stored: string | null, prefersDark: boolean): Theme {
  if (stored === "light" || stored === "dark") {
    return stored;
  }
  return prefersDark ? "dark" : "light";
}

function safeReadStoredTheme(): string | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function prefersDarkScheme(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-color-scheme: dark)").matches
    : false;
}

function syncDocumentTheme(theme: Theme): void {
  if (typeof document !== "undefined") {
    document.documentElement.dataset.theme = theme;
  }
}

export function useTheme(): { theme: Theme; toggleTheme(): void } {
  const [theme, setTheme] = useState<Theme>(() => {
    const initial = resolveInitialTheme(safeReadStoredTheme(), prefersDarkScheme());
    syncDocumentTheme(initial);
    return initial;
  });

  const toggleTheme = useCallback(() => {
    setTheme((current) => {
      const next: Theme = current === "dark" ? "light" : "dark";
      try {
        localStorage.setItem(STORAGE_KEY, next);
      } catch {
        // 持久化失败（如隐私模式）不影响本次会话切换
      }
      syncDocumentTheme(next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
