/**
 * Couleur de la bande d'une carte selon sa famille. Toujours la même couleur pour la même famille
 * (calculée depuis le nom, rien à enregistrer) ; palette lisible en clair comme en sombre.
 */
const PALETTE = ["#8F7CFF", "#E8913A", "#2FA7A0", "#D9558C", "#4F8DF0", "#7DB544", "#C9A227", "#C26A4A"];

export function couleurFamille(famille: string): string {
  let h = 0;
  for (const c of famille.trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
