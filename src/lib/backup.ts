import { supabase } from "@/integrations/supabase/client";

/**
 * Sauvegarde JSON des donnees d'Index (fiches, categories, fournisseurs, et chantiers si connecte).
 * Les PDF eux-memes restent dans le stockage : seuls leurs noms de fichiers sont exportes.
 */
export async function exportBackup(): Promise<number> {
  const [p, c, s, pr, pp] = await Promise.all([
    supabase.from("products").select("*"),
    supabase.from("categories").select("*"),
    supabase.from("suppliers").select("*"),
    supabase.from("projects").select("*"),
    supabase.from("product_projects").select("*"),
  ]);
  if (p.error) throw p.error;
  const data = {
    app: "index",
    version: 2,
    exported_at: new Date().toISOString(),
    products: p.data ?? [],
    categories: c.data ?? [],
    suppliers: s.data ?? [],
    // Chantiers : lisibles seulement une fois connecte
    projects: pr.error ? [] : pr.data ?? [],
    product_projects: pp.error ? [] : pp.data ?? [],
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `index-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  return data.products.length;
}
