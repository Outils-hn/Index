import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/components/ProductCard";
import { fetchProductProjectsMap } from "@/lib/projects";

export async function fetchProductsWithAuthors(): Promise<Product[]> {
  const { data: products, error } = await supabase
    .from("products")
    .select("id,name,supplier,category,tags,pdf_path,pdf_filename,url,note,updated_at,created_by")
    .order("updated_at", { ascending: false });
  if (error) throw error;

  const ids = Array.from(
    new Set((products ?? []).map((p) => p.created_by).filter((v): v is string => !!v)),
  );

  let profileMap = new Map<
    string,
    { display_name: string | null; email: string | null; first_name: string | null; last_name: string | null }
  >();
  if (ids.length > 0) {
    const { data: profiles } = await supabase.rpc("get_public_profiles", { _ids: ids });
    profileMap = new Map(
      (profiles ?? []).map((p) => [
        p.id,
        {
          display_name: p.display_name,
          email: null,
          first_name: (p as any).first_name ?? null,
          last_name: (p as any).last_name ?? null,
        },
      ]),
    );
  }

  const projectsMap = await fetchProductProjectsMap();

  return (products ?? []).map((p) => ({
    ...p,
    author: p.created_by ? profileMap.get(p.created_by) ?? null : null,
    projects: projectsMap.get(p.id) ?? [],
  })) as Product[];
}