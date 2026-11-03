import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { plain } from "./search";

/** Adresse de l'annuaire Access (meme base Supabase : lecture libre des fournisseurs). */
export const ACCESS_URL = "https://outils-hn.github.io/Access";

export type FournisseurAccess = { id: string; nom: string };

/** Mots significatifs d'un nom de fournisseur : sans accents, sans ponctuation, 2 lettres et plus. */
const mots = (nom: string) => plain(nom).split(/[\s\-–&.,()]+/).filter((m) => m.length > 1);

/**
 * Fournisseur Access qui correspond au fournisseur d'une fiche Index, ou null.
 * Un fournisseur Access correspond quand TOUS les mots de son nom sont dans celui de la fiche
 * (« Schüco » dans « Schüco International KG »). En cas de plusieurs candidats : le nom identique
 * d'abord, sinon celui qui a le plus de mots ; a egalite, aucun lien plutot qu'un mauvais lien.
 */
export function trouverFournisseurAccess(fournisseur: string | null | undefined, liste: FournisseurAccess[]): FournisseurAccess | null {
  const cible = plain(fournisseur);
  if (!cible.trim()) return null;
  const motsCible = new Set(mots(cible));
  const candidats = liste
    .map((f) => ({ f, m: mots(f.nom) }))
    .filter(({ m }) => m.length > 0 && m.every((x) => motsCible.has(x)));
  if (!candidats.length) return null;
  const exact = candidats.filter(({ f }) => plain(f.nom).trim() === cible.trim());
  if (exact.length === 1) return exact[0].f;
  if (exact.length > 1) return null;
  const max = Math.max(...candidats.map(({ m }) => m.length));
  const meilleurs = candidats.filter(({ m }) => m.length === max);
  return meilleurs.length === 1 ? meilleurs[0].f : null;
}

const COPIE = "index:access-fournisseurs:v1";
const lireCopie = (): FournisseurAccess[] => {
  try { const raw = localStorage.getItem(COPIE); return raw ? JSON.parse(raw) : []; } catch { return []; }
};

/**
 * Noms des fournisseurs d'Access (table access_fournisseurs, lecture libre), avec copie locale pour
 * la lecture hors connexion. Si la table n'existe pas ou ne repond pas : liste vide, aucun lien.
 */
export function useFournisseursAccess(): FournisseurAccess[] {
  const q = useQuery({
    queryKey: ["access-fournisseurs"],
    staleTime: 10 * 60_000,
    retry: 0,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase as any).from("access_fournisseurs").select("id,nom");
      if (error) throw error;
      const liste = (data ?? []) as FournisseurAccess[];
      try { localStorage.setItem(COPIE, JSON.stringify(liste)); } catch { /* stockage plein ou bloque */ }
      return liste;
    },
  });
  return q.data ?? (q.isError ? lireCopie() : []);
}
