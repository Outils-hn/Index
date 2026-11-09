import { describe, it, expect } from "vitest";
import { cheminPdf, simple } from "./pdf-path";

describe("chemin d'une fiche dans le stockage", () => {
  it("accepte les familles avec accents et « & » (cas réel : Membranes & Étanchéité)", () => {
    expect(cheminPdf("Membranes & Étanchéité", "Doc_SikaMembran_Universal_SB.pdf", 1794231311887))
      .toBe("Membranes_Etancheite/1794231311887-Doc_SikaMembran_Universal_SB.pdf");
  });
  it("nettoie aussi le nom du fichier", () => {
    expect(cheminPdf("Isolation", "Fiche été (v2).pdf", 1)).toBe("Isolation/1-Fiche_ete_v2_.pdf");
  });
  it("ne produit que des caractères simples et ne reste jamais vide", () => {
    expect(/^[A-Za-z0-9._\/-]+$/.test(cheminPdf("é & ç", "…", 5))).toBe(true);
    expect(simple("")).toBe("");
    expect(cheminPdf("", "", 5)).toBe("divers/5-fiche.pdf");
  });
});
