/**
 * Couleur d'une famille (nom et icone sur la carte). Toujours la meme pour la meme famille (calculee depuis le nom,
 * rien a enregistrer). Deux jeux : un plus fonce pour le mode clair, un plus vif pour le mode sombre (texte lisible dans les deux).
 */
const CLAIR = ["#5B45E0", "#944700", "#0B6F69", "#B3245F", "#2859BC", "#3F6F18", "#7A5C00", "#A3401F"];
const SOMBRE = ["#B3A7FF", "#F2A860", "#4FD1C5", "#F58AB6", "#8DB4FF", "#9BD36A", "#E6C65A", "#E89A7E"];

export function couleurFamille(famille: string): { clair: string; sombre: string } {
  // Graine 452 : choisie pour que les 8 familles actuelles aient chacune une couleur differente
  let h = 452;
  for (const c of famille.trim().toLowerCase()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  h ^= h >>> 15; h = Math.imul(h, 2246822519) >>> 0; h ^= h >>> 13;
  const i = (h >>> 0) % CLAIR.length;
  return { clair: CLAIR[i], sombre: SOMBRE[i] };
}
