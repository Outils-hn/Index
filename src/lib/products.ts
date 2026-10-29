import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/components/ProductCard";
import { fetchProductProjectsMap } from "@/lib/projects";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/** Au-dela de ce delai sans reponse, la base est consideree injoignable. */
const TIMEOUT_MS = 5000;
const withTimeout = <T,>(p: PromiseLike<T>) =>
  Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("Délai dépassé")), TIMEOUT_MS))]);

/**
 * Toutes les fiches, corbeille comprise (deleted_at renseigne) : chaque ecran filtre ce qu'il montre.
 * « * » plutot qu'une liste de colonnes : l'appli marche encore si la base n'a pas les colonnes de la 2.0.
 */
export async function fetchProductsWithAuthors(): Promise<Product[]> {
  const { data: products, error } = await withTimeout(
    supabase.from("products").select("*").order("updated_at", { ascending: false }),
  );
  if (error) throw error;

  const ids = Array.from(
    new Set((products ?? []).map((p) => p.created_by).filter((v): v is string => !!v)),
  );

  let profileMap = new Map<
    string,
    { display_name: string | null; email: string | null; first_name: string | null; last_name: string | null }
  >();
  if (ids.length > 0) {
    const { data: profiles } = await supabase.rpc("get_public_profiles", { _ids: ids });
    profileMap = new Map(
      (profiles ?? []).map((p) => [
        p.id,
        {
          display_name: p.display_name,
          email: null,
          first_name: (p as any).first_name ?? null,
          last_name: (p as any).last_name ?? null,
        },
      ]),
    );
  }

  // Chantiers : visibles seulement une fois connecte ; pour un visiteur, simplement aucun
  const projectsMap = await fetchProductProjectsMap().catch(() => new Map());

  const { data: categories } = await supabase.from("categories").select("name,icon");
  const categoryIconMap = new Map((categories ?? []).map((c) => [c.name, c.icon]));

  const out = (products ?? []).map((p) => ({
    ...p,
    author: p.created_by ? profileMap.get(p.created_by) ?? null : null,
    projects: projectsMap.get(p.id) ?? [],
    category_icon: categoryIconMap.get(p.category) ?? null,
  })) as Product[];
  writeCache(out);
  return out;
}

// Copie locale de la derniere lecture reussie : sans connexion, la bibliotheque reste
// consultable en lecture seule au lieu de rester sur « Chargement… ».
const CACHE_KEY = "index:copie-locale:v1";
function writeCache(products: Product[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify({ at: new Date().toISOString(), products })); } catch { /* stockage plein ou bloque */ }
}
function readCache(): { at: string; products: Product[] } | null {
  try {
    const raw = typeof window === "undefined" ? null : localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

/** Fiches pour les ecrans de consultation, avec repli sur la copie locale si la base ne repond pas. */
export function useProducts() {
  const q = useQuery({ queryKey: ["products"], queryFn: fetchProductsWithAuthors, retry: 0 });
  const failed = !!q.error && !q.data;
  const cached = useMemo(() => (failed ? readCache() : null), [failed]);
  if (failed && cached) return { products: cached.products, isLoading: false, error: null, offlineSince: cached.at, refetch: q.refetch };
  return { products: q.data ?? [], isLoading: q.isLoading, error: q.error, offlineSince: null as string | null, refetch: q.refetch };
}