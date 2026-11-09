import { describe, it, expect } from "vitest";
import { couleurFamille } from "./famille-couleur";

describe("couleur d'une famille", () => {
  it("est toujours la même pour la même famille, quelle que soit la casse", () => {
    expect(couleurFamille("Colles & mastics")).toBe(couleurFamille(" colles & MASTICS "));
  });
  it("renvoie une couleur hexadécimale, même pour une famille vide", () => {
    expect(couleurFamille("")).toMatch(/^#[0-9A-F]{6}$/i);
    expect(couleurFamille("Membranes & Étanchéité")).toMatch(/^#[0-9A-F]{6}$/i);
  });
});
