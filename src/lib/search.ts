import type { Product } from "@/components/ProductCard";

/** Texte sans accents ni majuscules : « Étanchéité » et « etancheite » se retrouvent. */
export const plain = (s: string | null | undefined) =>
  (s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Tout le texte cherchable d'une fiche : nom, fournisseur, categorie, tags, note, chantiers. */
export function haystack(p: Product): string {
  return plain(
    [p.name, p.supplier, p.category, ...(p.tags ?? []), p.note, ...(p.projects ?? []).flatMap((pr) => [pr.numero, pr.nom])].join(" "),
  );
}

/**
 * Recherche mot par mot : chaque mot tape doit apparaitre quelque part dans la fiche,
 * dans n'importe quel ordre (« hft 140 » trouve « Cheville HFT 8x140 »).
 */
export function matches(p: Product, query: string, hay = haystack(p)): boolean {
  const words = plain(query).split(/\s+/).filter(Boolean);
  return words.every((w) => hay.includes(w));
}

export type Validity = "valid" | "warn" | "expired";
const MONTH = 1000 * 60 * 60 * 24 * 30.4375;

/** Date de reference de la validite : la derniere verification, sinon la derniere modification. */
export const checkedAt = (p: Pick<Product, "verified_at" | "updated_at">) => p.verified_at ?? p.updated_at;

export function validity(p: Pick<Product, "verified_at" | "updated_at">, now = Date.now()): Validity {
  const months = (now - new Date(checkedAt(p)).getTime()) / MONTH;
  if (months < 12) return "valid";
  if (months < 24) return "warn";
  return "expired";
}

export const VALIDITY_LABEL: Record<Validity, string> = {
  valid: "À jour",
  warn: "À vérifier",
  expired: "Probablement périmée",
};

/** Nombres au format suisse, comme les autres applis de la famille : 1'200. */
export const num = (n: number) => n.toLocaleString("fr-FR").replace(/[\s  ]/g, "'");
