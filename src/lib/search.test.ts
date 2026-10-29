import { describe, it, expect } from "vitest";
import { matches, validity, num, plain } from "./search";
import type { Product } from "@/components/ProductCard";

const p = (o: Partial<Product>): Product => ({
  id: "1", name: "Cheville HFT 8x140", supplier: "HFT", category: "Fixations & Chevilles", tags: ["isolant", "façade"],
  pdf_path: null, pdf_filename: null, url: null, note: null, updated_at: new Date().toISOString(), created_by: null,
  projects: [{ id: "c", numero: "24-118", nom: "Résidence Les Tilleuls" }], ...o,
});

describe("recherche", () => {
  it("ignore accents et majuscules", () => {
    expect(plain("Étanchéité")).toBe("etancheite");
    expect(matches(p({ category: "Membranes & Étanchéité" }), "etancheite")).toBe(true);
  });
  it("cherche mot par mot, dans n'importe quel ordre", () => {
    expect(matches(p({}), "140 hft")).toBe(true);
    expect(matches(p({}), "hft sika")).toBe(false);
  });
  it("trouve la categorie, la note et le chantier", () => {
    expect(matches(p({}), "chevilles")).toBe(true);
    expect(matches(p({ note: "Ne pas poser sous 5 °C" }), "poser")).toBe(true);
    expect(matches(p({}), "24-118")).toBe(true);
    expect(matches(p({}), "tilleuls")).toBe(true);
  });
  it("recherche vide = tout", () => expect(matches(p({}), "  ")).toBe(true));
});

describe("validite", () => {
  const now = new Date("2026-10-29").getTime();
  const ago = (m: number) => new Date(now - m * 30.44 * 864e5).toISOString();
  it("suit la date de verification, pas la modification", () => {
    expect(validity({ updated_at: ago(1), verified_at: ago(30) }, now)).toBe("expired");
    expect(validity({ updated_at: ago(30), verified_at: ago(1) }, now)).toBe("valid");
  });
  it("sans verification : date de modification", () => {
    expect(validity({ updated_at: ago(14), verified_at: null }, now)).toBe("warn");
  });
});

describe("nombres", () => it("format suisse", () => expect(num(1200)).toBe("1'200")));
