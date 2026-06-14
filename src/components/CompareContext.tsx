import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import type { Product } from "@/components/ProductCard";

export const MAX_COMPARE = 3;

interface CompareContextValue {
  selected: Product[];
  ids: Set<string>;
  toggle: (p: Product) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
}

const CompareContext = createContext<CompareContextValue | null>(null);

export function CompareProvider({ children }: { children: ReactNode }) {
  const [selected, setSelected] = useState<Product[]>([]);

  const ids = useMemo(() => new Set(selected.map((p) => p.id)), [selected]);

  const toggle = useCallback((p: Product) => {
    setSelected((prev) => {
      if (prev.some((x) => x.id === p.id)) return prev.filter((x) => x.id !== p.id);
      if (prev.length >= MAX_COMPARE) {
        toast.error(`Maximum ${MAX_COMPARE} produits à comparer`);
        return prev;
      }
      return [...prev, p];
    });
  }, []);

  const clear = useCallback(() => setSelected([]), []);
  const isSelected = useCallback((id: string) => ids.has(id), [ids]);

  const value = useMemo(
    () => ({ selected, ids, toggle, clear, isSelected }),
    [selected, ids, toggle, clear, isSelected],
  );

  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export function useCompare() {
  const ctx = useContext(CompareContext);
  if (!ctx) throw new Error("useCompare must be used within CompareProvider");
  return ctx;
}