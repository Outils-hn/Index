import { useCallback, useEffect, useState } from "react";

const KEY = "favorites:product-ids";
const EVENT = "favorites:changed";

function read(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function write(set: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(Array.from(set)));
  window.dispatchEvent(new Event(EVENT));
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<Set<string>>(() => read());

  useEffect(() => {
    const sync = () => setFavorites(read());
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const isFavorite = useCallback((id: string) => favorites.has(id), [favorites]);

  const toggle = useCallback((id: string) => {
    const next = read();
    if (next.has(id)) next.delete(id);
    else next.add(id);
    write(next);
    setFavorites(new Set(next));
  }, []);

  return { favorites, isFavorite, toggle };
}