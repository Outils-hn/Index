import { describe, it, expect } from "vitest";
import { couleurFamille } from "./famille-couleur";

describe("couleur d'une famille", () => {
  it("est toujours la même pour la même famille, quelle que soit la casse", () => {
    expect(couleurFamille("Colles & mastics")).toEqual(couleurFamille(" colles & MASTICS "));
  });
  it("donne une couleur hexadécimale claire et une sombre, même pour une famille vide", () => {
    for (const f of ["", "Membranes & Étanchéité"]) {
      const c = couleurFamille(f);
      expect(c.clair).toMatch(/^#[0-9A-F]{6}$/i);
      expect(c.sombre).toMatch(/^#[0-9A-F]{6}$/i);
    }
  });
});
