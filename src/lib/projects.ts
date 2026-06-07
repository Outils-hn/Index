import { supabase } from "@/integrations/supabase/client";

export interface Project {
  id: string;
  numero: string;
  nom: string;
}

export async function fetchProjects(): Promise<Project[]> {
  const { data, error } = await supabase
    .from("projects")
    .select("id,numero,nom")
    .order("numero", { ascending: true });
  if (error) throw error;
  return data ?? [];
}

export async function createProject(numero: string, nom: string): Promise<Project> {
  const { data, error } = await supabase
    .from("projects")
    .insert({ numero: numero.trim(), nom: nom.trim() })
    .select("id,numero,nom")
    .single();
  if (error) throw error;
  return data;
}

export async function updateProject(id: string, numero: string, nom: string) {
  const { error } = await supabase
    .from("projects")
    .update({ numero: numero.trim(), nom: nom.trim() })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteProject(id: string) {
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw error;
}

export async function fetchProductProjectsMap(): Promise<Map<string, Project[]>> {
  const { data, error } = await supabase
    .from("product_projects")
    .select("product_id, projects:project_id ( id, numero, nom )");
  if (error) throw error;
  const map = new Map<string, Project[]>();
  for (const row of (data ?? []) as Array<{ product_id: string; projects: Project | null }>) {
    if (!row.projects) continue;
    const arr = map.get(row.product_id) ?? [];
    arr.push(row.projects);
    map.set(row.product_id, arr);
  }
  return map;
}

export async function setProductProjects(productId: string, projectIds: string[]) {
  const { error: delErr } = await supabase
    .from("product_projects")
    .delete()
    .eq("product_id", productId);
  if (delErr) throw delErr;
  if (projectIds.length === 0) return;
  const rows = projectIds.map((pid) => ({ product_id: productId, project_id: pid }));
  const { error } = await supabase.from("product_projects").insert(rows);
  if (error) throw error;
}