import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, FileText, Trash2, Loader2, Plus, X, Pencil, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { fetchProductsWithAuthors } from "@/lib/products";
import {
  fetchCategories,
  fetchSuppliers,
  createCategory,
  createSupplier,
} from "@/lib/taxonomies";
import { QuickAddDialog } from "@/components/QuickAddDialog";
import { EditProductDialog } from "@/components/EditProductDialog";
import { ProjectsMultiSelect } from "@/components/ProjectsMultiSelect";
import { fetchProjects, setProductProjects } from "@/lib/projects";
import type { Product } from "@/components/ProductCard";
import { fmtDate } from "@/components/ProductCard";
import { ask } from "@/lib/confirm";
import { matches } from "@/lib/search";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — Index" },
      { name: "description", content: "Ajouter et gérer les fiches techniques produits." },
    ],
  }),
  component: Admin,
});

const MAX_SIZE = 5 * 1024 * 1024;

function Admin() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [name, setName] = useState("");
  const [supplier, setSupplier] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [tagsInput, setTagsInput] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProductsWithAuthors,
  });

  const active = useMemo(() => products.filter((p) => !p.deleted_at), [products]);
  const trashed = useMemo(() => products.filter((p) => p.deleted_at).sort((a, b) => b.deleted_at!.localeCompare(a.deleted_at!)), [products]);
  const filteredProducts = useMemo(() => active.filter((p) => matches(p, search)), [active, search]);

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers,
  });
  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    if (rejected.length > 0) {
      const r = rejected[0];
      if (r.errors?.[0]?.code === "file-too-large") {
        toast.error("Le fichier dépasse 5 Mo.");
      } else if (r.errors?.[0]?.code === "file-invalid-type") {
        toast.error("Seuls les fichiers PDF sont acceptés.");
      } else {
        toast.error("Fichier refusé.");
      }
      return;
    }
    if (accepted[0]) setFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: MAX_SIZE,
    multiple: false,
  });

  const reset = () => {
    setName("");
    setSupplier("");
    setCategory("");
    setTagsInput("");
    setUrl("");
    setNote("");
    setFile(null);
    setSelectedProjects([]);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Vous devez être connecté.");
      if (!name.trim() || !supplier || !category) {
        throw new Error("Merci de remplir tous les champs requis.");
      }
      if (!file && !url.trim()) {
        throw new Error("Ajoutez un PDF ou renseignez l'URL du produit.");
      }

      let pdf_path: string | null = null;
      let pdf_filename: string | null = null;
      if (file) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${category}/${Date.now()}-${safeName}`;
        const upload = await supabase.storage
          .from("technical-sheets")
          .upload(path, file, { contentType: "application/pdf", upsert: false });
        if (upload.error) throw upload.error;
        pdf_path = path;
        pdf_filename = file.name;
      }

      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const { data: inserted, error } = await supabase.from("products").insert({
        name: name.trim(),
        supplier,
        category,
        tags,
        pdf_path,
        pdf_filename,
        url: url.trim() || null,
        note: note.trim() || null,
        created_by: user.id,
      }).select("id").single();
      if (error) {
        if (pdf_path) await supabase.storage.from("technical-sheets").remove([pdf_path]);
        throw error;
      }
      if (inserted && selectedProjects.length > 0) {
        await setProductProjects(inserted.id, selectedProjects);
      }
    },
    onSuccess: () => {
      toast.success("Produit ajouté.");
      reset();
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Suppression en deux temps : corbeille (30 jours, restaurable), puis suppression definitive
  // qui efface aussi le PDF du stockage
  const trashMutation = useMutation({
    mutationFn: async ({ id, back }: { id: string; back?: boolean }) => {
      const { error } = await supabase.from("products").update({ deleted_at: back ? null : new Date().toISOString() }).eq("id", id);
      if (error) {
        if (/deleted_at/.test(error.message)) throw new Error("La base n'a pas encore la corbeille : appliquez la mise à jour de la base (voir la demande de fusion).");
        throw error;
      }
      return back;
    },
    onSuccess: (back) => {
      toast.success(back ? "Fiche restaurée." : "Fiche mise à la corbeille (restaurable 30 jours).");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const purgeMutation = useMutation({
    mutationFn: async (p: { id: string; pdf_path: string | null }) => {
      if (p.pdf_path) await supabase.storage.from("technical-sheets").remove([p.pdf_path]);
      const { error } = await supabase.from("products").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiche supprimée définitivement.");
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-6xl px-6 py-16 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement de la session…
        </main>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10 grid lg:grid-cols-[1fr_1.2fr] gap-10">
        <section>
          <div className="mb-6">
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-1">
              Nouveau produit
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Ajouter une fiche technique</h1>
          </div>

          <div className="rounded-lg border border-border bg-card p-6 space-y-5">
            <div className="space-y-2">
              <Label htmlFor="name">Nom du produit *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Sikaflex-11 FC+"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Fournisseur *</Label>
                <div className="flex gap-2">
                  <Select value={supplier} onValueChange={setSupplier}>
                    <SelectTrigger className="flex-1" aria-label="Fournisseur"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setSupplierDialogOpen(true)}
                    aria-label="Ajouter un fournisseur"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Catégorie *</Label>
                <div className="flex gap-2">
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger className="flex-1" aria-label="Catégorie"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.name}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    onClick={() => setCategoryDialogOpen(true)}
                    aria-label="Ajouter une catégorie"
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Mots-clés / Tags</Label>
              <Input
                id="tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="étanchéité, polyuréthane, extérieur"
              />
              <p className="text-xs text-muted-foreground">Séparés par des virgules.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="url">Lien internet du produit (URL)</Label>
              <Input
                id="url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.fournisseur.com/produit"
              />
              <p className="text-xs text-muted-foreground">Optionnel.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note ou avertissement (facultatif)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Ex. Ne pas laisser au soleil, temps de séchage 24h…"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Projets / Chantiers associés</Label>
              <ProjectsMultiSelect
                projects={projects}
                selectedIds={selectedProjects}
                onChange={setSelectedProjects}
              />
            </div>

            <div className="space-y-2">
              <Label>Fiche technique (PDF, max 5 Mo)</Label>
              <p className="text-xs text-muted-foreground -mt-1">
                Facultatif si une URL produit est renseignée.
              </p>
              {!file ? (
                <div
                  {...getRootProps()}
                  className={`rounded-lg border-2 border-dashed transition cursor-pointer p-8 text-center ${
                    isDragActive
                      ? "border-index bg-index-soft"
                      : "border-border hover:border-foreground/40 hover:bg-muted/50"
                  }`}
                >
                  <input {...getInputProps()} aria-label="Choisir le PDF de la fiche" />
                  <UploadCloud className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <div className="font-medium text-sm">
                    {isDragActive ? "Déposez le fichier ici" : "Glissez-déposez le PDF ici"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">
                    ou cliquez pour parcourir
                  </div>
                </div>
              ) : (
                <div className="rounded-lg border border-border bg-secondary/40 p-4 flex items-center gap-3">
                  <FileText className="h-6 w-6 text-index shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} Ko
                    </div>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Retirer le PDF"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>

            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground h-11"
            >
              {createMutation.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Plus className="h-4 w-4 mr-2" />
              )}
              Enregistrer le produit
            </Button>
          </div>
        </section>

        <section>
          <div className="mb-6">
            <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-1">
              Catalogue
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Produits enregistrés
              <span className="text-muted-foreground font-normal text-base ml-2">
                ({active.length})
              </span>
            </h2>
          </div>

          <div className="relative mb-5">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrer par nom, fournisseur, catégorie ou tag…"
              aria-label="Filtrer les fiches"
              className="pl-11 pr-11 h-12 text-base bg-card border-border focus-visible:ring-accent"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label="Effacer le filtre"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {products.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Aucun produit pour le moment.
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Aucun résultat pour « {search} ».
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {filteredProducts.map((p) => (
                  <li key={p.id} className="flex items-center gap-4 p-4 hover:bg-secondary/40">
                    <div className="h-10 w-10 rounded-md bg-secondary grid place-items-center text-muted-foreground shrink-0">
                      <FileText className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {p.supplier} · {p.category}
                        {p.author && (
                          <> · <span className="italic">
                            {[p.author.first_name, p.author.last_name].filter(Boolean).join(" ") || p.author.display_name}
                          </span></>
                        )}
                      </div>
                    </div>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditing(p)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={`Modifier ${p.name}`}
                      >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (await ask({ title: `Mettre « ${p.name} » à la corbeille ?`, message: "Vous pourrez la restaurer pendant 30 jours, PDF compris.", confirm: "Mettre à la corbeille", danger: true })) {
                            trashMutation.mutate({ id: p.id });
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Supprimer ${p.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {trashed.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-3 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
                Corbeille ({trashed.length})
              </h2>
              <ul className="divide-y divide-border rounded-lg border border-border bg-card">
                {trashed.map((p) => (
                  <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="truncate">{p.name}</div>
                      <div className="text-xs text-muted-foreground">{p.supplier} · supprimée le <span className="num">{fmtDate(p.deleted_at!)}</span></div>
                    </div>
                    <button className="rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted" onClick={() => trashMutation.mutate({ id: p.id, back: true })}>
                      Restaurer
                    </button>
                    <button
                      className="rounded-md px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
                      onClick={async () => {
                        if (await ask({ title: `Supprimer définitivement « ${p.name} » ?`, message: "La fiche et son PDF seront effacés. Impossible de revenir en arrière.", confirm: "Supprimer définitivement", danger: true })) {
                          purgeMutation.mutate({ id: p.id, pdf_path: p.pdf_path });
                        }
                      }}
                    >
                      Supprimer définitivement
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </main>

      <QuickAddDialog
        open={supplierDialogOpen}
        onOpenChange={setSupplierDialogOpen}
        title="Nouveau fournisseur"
        description="Ce fournisseur sera disponible dans tous les formulaires."
        label="Nom du fournisseur"
        placeholder="Ex. Sika"
        onSubmit={async (n) => {
          const c = await createSupplier(n);
          qc.invalidateQueries({ queryKey: ["suppliers"] });
          return c;
        }}
        onCreated={(n) => setSupplier(n)}
      />
      <QuickAddDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        title="Nouvelle catégorie"
        description="Cette catégorie sera disponible dans tous les formulaires."
        label="Nom de la catégorie"
        placeholder="Ex. Isolants"
        onSubmit={async (n) => {
          const c = await createCategory(n);
          qc.invalidateQueries({ queryKey: ["categories"] });
          return c;
        }}
        onCreated={(n) => setCategory(n)}
      />
      <EditProductDialog
        product={editing}
        open={!!editing}
        onOpenChange={(o) => { if (!o) setEditing(null); }}
      />
    </div>
  );
}