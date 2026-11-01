import { useEffect, useState, useCallback } from "react";

export type Theme = "light" | "dark";

const STORAGE_KEY = "theme";
// Reglage commun a toutes les applis (meme site) : le choix clair / sombre suit d'une appli a l'autre.
const SHARED_KEY = "outils-theme";

function getInitial(): Theme {
  if (typeof window === "undefined") return "light";
  const stored = (window.localStorage.getItem(SHARED_KEY) || window.localStorage.getItem(STORAGE_KEY)) as Theme | null;
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function apply(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const initial = getInitial();
    setThemeState(initial);
    apply(initial);

    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e: MediaQueryListEvent) => {
      if (!window.localStorage.getItem(SHARED_KEY) && !window.localStorage.getItem(STORAGE_KEY)) {
        const next: Theme = e.matches ? "dark" : "light";
        setThemeState(next);
        apply(next);
      }
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const setTheme = useCallback((next: Theme) => {
    window.localStorage.setItem(STORAGE_KEY, next);
    window.localStorage.setItem(SHARED_KEY, next);
    setThemeState(next);
    apply(next);
  }, []);

  const toggle = useCallback(() => {
    setTheme(theme === "dark" ? "light" : "dark");
  }, [theme, setTheme]);

  return { theme, setTheme, toggle };
}