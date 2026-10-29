import type { Product } from "@/components/ProductCard";
import { checkedAt, validity } from "./search";

/** Nombre de fiches proposees a la relecture chaque mois : une petite dose, faisable en 10 minutes. */
export const DOSE_DU_MOIS = 5;

/** Les fiches a relire en priorite : non a jour, de la plus anciennement verifiee a la plus recente. */
export function aRelire(products: Product[], now = Date.now(), n = DOSE_DU_MOIS): Product[] {
  return products
    .filter((p) => !p.deleted_at && validity(p, now) !== "valid")
    .sort((a, b) => checkedAt(a).localeCompare(checkedAt(b)))
    .slice(0, n);
}

/** Fiches verifiees depuis le 1er du mois en cours (pour le compteur « ce mois »). */
export function verifieesCeMois(products: Product[], now = new Date()): number {
  const debut = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return products.filter((p) => !p.deleted_at && p.verified_at && new Date(p.verified_at).getTime() >= debut).length;
}

/** Age lisible d'une verification : « il y a 14 mois », « il y a 2 ans et 3 mois ». */
export function depuis(iso: string, now = Date.now()): string {
  const mois = Math.max(0, Math.floor((now - new Date(iso).getTime()) / (1000 * 60 * 60 * 24 * 30.4375)));
  if (mois < 12) return `il y a ${mois} mois`;
  const ans = Math.floor(mois / 12), reste = mois % 12;
  return `il y a ${ans} an${ans > 1 ? "s" : ""}${reste ? ` et ${reste} mois` : ""}`;
}
