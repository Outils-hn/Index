import { describe, it, expect } from "vitest";
import { trouverFournisseurAccess } from "./access";

const L = [
  { id: "1", nom: "Schüco" },
  { id: "2", nom: "Sika" },
  { id: "3", nom: "Sika Automotive" },
  { id: "4", nom: "HFT" },
  { id: "5", nom: "Würth" },
  { id: "6", nom: "Isover" },
];

describe("lien fiche Index -> fournisseur Access", () => {
  it("ignore accents et majuscules", () => {
    expect(trouverFournisseurAccess("SCHUCO", L)?.id).toBe("1");
    expect(trouverFournisseurAccess("wurth", L)?.id).toBe("5");
  });
  it("trouve le fournisseur dans un nom plus long", () => {
    expect(trouverFournisseurAccess("Schüco International KG", L)?.id).toBe("1");
    expect(trouverFournisseurAccess("Saint-Gobain Isover SA", L)?.id).toBe("6");
  });
  it("prefere le nom identique, puis le plus precis", () => {
    expect(trouverFournisseurAccess("Sika", L)?.id).toBe("2");
    expect(trouverFournisseurAccess("Sika Automotive AG", L)?.id).toBe("3");
  });
  it("ne propose rien quand rien ne correspond ou en cas d'egalite", () => {
    expect(trouverFournisseurAccess("Flumroc AG", L)).toBeNull();
    expect(trouverFournisseurAccess("", L)).toBeNull();
    expect(trouverFournisseurAccess(null, L)).toBeNull();
    expect(trouverFournisseurAccess("Foo Bar", [{ id: "a", nom: "Foo" }, { id: "b", nom: "Bar" }])).toBeNull();
  });
  it("un mot partiel ne correspond pas (« Sik » n'est pas « Sika »)", () => {
    expect(trouverFournisseurAccess("Sikaflex", L)).toBeNull();
  });
});
