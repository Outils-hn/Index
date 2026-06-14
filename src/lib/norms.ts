import { supabase } from "@/integrations/supabase/client";

// Until types.ts is regenerated, work against an untyped accessor.
const db = supabase as unknown as {
  from: (table: string) => any;
};

export interface NormCategory {
  id: string;
  name: string;
  icon?: string | null;
}

export interface Norm {
  id: string;
  name: string;
  source: string | null;
  category: string;
  tags: string[];
  domain: string | null;
  pdf_path: string | null;
  pdf_filename: string | null;
  url: string | null;
  note: string | null;
  updated_at: string;
  created_by: string | null;
}

export async function fetchNorms(): Promise<Norm[]> {
  const { data, error } = await db
    .from("norms")
    .select(
      "id,name,source,category,tags,domain,pdf_path,pdf_filename,url,note,updated_at,created_by",
    )
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Norm[];
}

export async function fetchNormCategories(): Promise<NormCategory[]> {
  const { data, error } = await db
    .from("norm_categories")
    .select("id,name,icon")
    .order("name", { ascending: true });
  if (error) throw error;
  return (data ?? []) as NormCategory[];
}

export async function createNormCategory(name: string, icon?: string | null) {
  const { data, error } = await db
    .from("norm_categories")
    .insert({ name: name.trim(), icon: icon ?? null })
    .select("id,name,icon")
    .single();
  if (error) throw error;
  return data as NormCategory;
}

export async function renameNormCategory(id: string, name: string) {
  const { error } = await db
    .from("norm_categories")
    .update({ name: name.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function updateNormCategoryIcon(id: string, icon: string | null) {
  const { error } = await db.from("norm_categories").update({ icon }).eq("id", id);
  if (error) throw error;
}

export async function deleteNormCategory(id: string) {
  const { error } = await db.from("norm_categories").delete().eq("id", id);
  if (error) throw error;
}

export interface NormInput {
  name: string;
  source: string | null;
  category: string;
  tags: string[];
  domain: string | null;
  pdf_path: string | null;
  pdf_filename: string | null;
  url: string | null;
  note: string | null;
}

export async function createNorm(input: NormInput, userId: string) {
  const { data, error } = await db
    .from("norms")
    .insert({ ...input, created_by: userId })
    .select("id")
    .single();
  if (error) throw error;
  return data as { id: string };
}

export async function updateNorm(id: string, input: Partial<NormInput>) {
  const { error } = await db
    .from("norms")
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteNorm(id: string) {
  const { error } = await db.from("norms").delete().eq("id", id);
  if (error) throw error;
}

export async function uploadNormPdf(file: File): Promise<{ path: string; filename: string }> {
  const ext = file.name.split(".").pop() ?? "pdf";
  const path = `norms/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("technical-sheets")
    .upload(path, file, { contentType: file.type || "application/pdf", upsert: false });
  if (error) throw error;
  return { path, filename: file.name };
}

export async function removeNormPdf(path: string) {
  await supabase.storage.from("technical-sheets").remove([path]);
}