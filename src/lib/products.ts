import { supabase } from "@/integrations/supabase/client";
import type { Product } from "@/components/ProductCard";

export async function fetchProductsWithAuthors(): Promise<Product[]> {
  const { data: products, error } = await supabase
    .from("products")
    .select("id,name,supplier,category,tags,pdf_path,pdf_filename,url,updated_at,created_by")
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
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id,display_name,email,first_name,last_name")
      .in("id", ids);
    profileMap = new Map(
      (profiles ?? []).map((p) => [
        p.id,
        {
          display_name: p.display_name,
          email: p.email,
          first_name: (p as any).first_name ?? null,
          last_name: (p as any).last_name ?? null,
        },
      ]),
    );
  }

  return (products ?? []).map((p) => ({
    ...p,
    author: p.created_by ? profileMap.get(p.created_by) ?? null : null,
  })) as Product[];
}