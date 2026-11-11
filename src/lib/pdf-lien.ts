import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

// Le dossier des fiches (technical-sheets) devient prive : chaque PDF s'ouvre par un lien temporaire signe (1 h),
// garde en memoire 50 min. Tant que le dossier est encore public (ou si la signature echoue), on retombe sur le lien public.
const DUREE = 3600;
const cache = new Map<string, { url: string; fin: number }>();

export async function lienPdf(chemin: string): Promise<string> {
  const c = cache.get(chemin);
  if (c && c.fin > Date.now()) return c.url;
  const { data, error } = await supabase.storage.from("technical-sheets").createSignedUrl(chemin, DUREE);
  if (error || !data?.signedUrl) return supabase.storage.from("technical-sheets").getPublicUrl(chemin).data.publicUrl;
  cache.set(chemin, { url: data.signedUrl, fin: Date.now() + (DUREE - 600) * 1000 });
  return data.signedUrl;
}

/** Lien du PDF pour un composant React (chaine vide le temps de le preparer). */
export function useLienPdf(chemin?: string | null): string {
  const [url, setUrl] = useState("");
  useEffect(() => {
    let actif = true;
    setUrl("");
    if (chemin) lienPdf(chemin).then((u) => { if (actif) setUrl(u); });
    return () => { actif = false; };
  }, [chemin]);
  return url;
}
