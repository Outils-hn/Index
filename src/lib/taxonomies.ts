import { supabase } from "@/integrations/supabase/client";

export interface Taxonomy {
  id: string;
  name: string;
}

export async function fetchCategories(): Promise<Taxonomy[]> {
  const { data, error } = await supabase
    .from("categories")
    .select("id,name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function fetchSuppliers(): Promise<Taxonomy[]> {
  const { data, error } = await supabase
    .from("suppliers")
    .select("id,name")
    .order("name", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createCategory(name: string): Promise<Taxonomy> {
  const { data, error } = await supabase
    .from("categories")
    .insert({ name: name.trim() })
    .select("id,name")
    .single();
  if (error) throw error;
  return data;
}

export async function createSupplier(name: string): Promise<Taxonomy> {
  const { data, error } = await supabase
    .from("suppliers")
    .insert({ name: name.trim() })
    .select("id,name")
    .single();
  if (error) throw error;
  return data;
}

export async function renameCategory(id: string, name: string) {
  const { error } = await supabase
    .from("categories")
    .update({ name: name.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function renameSupplier(id: string, name: string) {
  const { error } = await supabase
    .from("suppliers")
    .update({ name: name.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from("categories").delete().eq("id", id);
  if (error) throw error;
}

export async function deleteSupplier(id: string) {
  const { error } = await supabase.from("suppliers").delete().eq("id", id);
  if (error) throw error;
}