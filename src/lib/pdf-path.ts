/**
 * Chemin d'une fiche PDF dans le stockage. Le stockage n'accepte que des caracteres simples (pas d'accent, de « & », d'espace) :
 * « Membranes & Étanchéité/ma fiche.pdf » est refuse (« Invalid key »). Le vrai nom reste dans `pdf_filename`.
 */
export function simple(texte: string): string {
  return texte.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-zA-Z0-9._-]+/g, "_").replace(/^_+|_+$/g, "");
}

export function cheminPdf(famille: string, nomFichier: string, maintenant: number = Date.now()): string {
  return `${simple(famille) || "divers"}/${maintenant}-${simple(nomFichier) || "fiche.pdf"}`;
}
