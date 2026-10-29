import { describe, it, expect } from "vitest";
import { aRelire, verifieesCeMois, depuis } from "./verification";
import type { Product } from "@/components/ProductCard";

const now = new Date("2026-10-29T10:00:00Z").getTime();
const ago = (m: number) => new Date(now - m * 30.44 * 864e5).toISOString();
const P = (id: string, verifiedMonthsAgo: number, extra: Partial<Product> = {}): Product => ({
  id, name: id, supplier: "S", category: "C", tags: [], pdf_path: null, pdf_filename: null, url: null, note: null,
  updated_at: ago(0), verified_at: ago(verifiedMonthsAgo), created_by: null, ...extra,
});

describe("fiches a relire du mois", () => {
  it("les plus anciennes d'abord, sans les fiches a jour ni la corbeille", () => {
    const list = [P("a", 13), P("b", 30), P("c", 2), P("d", 20), P("e", 40, { deleted_at: ago(0) })];
    expect(aRelire(list, now).map((p) => p.id)).toEqual(["b", "d", "a"]);
  });
  it("limite a la dose du mois", () => {
    const list = Array.from({ length: 12 }, (_, i) => P(`p${i}`, 13 + i));
    expect(aRelire(list, now)).toHaveLength(5);
  });
  it("compte les fiches verifiees ce mois", () => {
    expect(verifieesCeMois([P("a", 0), P("b", 2), P("c", 0)], new Date(now))).toBe(2);
  });
  it("age lisible", () => {
    expect(depuis(ago(14), now)).toBe("il y a 1 an et 2 mois");
    expect(depuis(ago(24), now)).toBe("il y a 2 ans");
    expect(depuis(ago(5), now)).toBe("il y a 5 mois");
  });
});
