import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, FileText, Trash2, Loader2, Plus, X, Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import type { Product } from "@/components/ProductCard";

export const Route = createFileRoute("/admin")({
  head: () => ({
    meta: [
      { title: "Administration — FaçadeTech" },
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
  const [file, setFile] = useState<File | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  const { data: products = [] } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProductsWithAuthors,
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });
  const { data: suppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: fetchSuppliers,
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
    setFile(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Vous devez être connecté.");
      if (!name.trim() || !supplier || !category) {
        throw new Error("Merci de remplir tous les champs requis.");
      }
      if (!file) throw new Error("Veuillez joindre un fichier PDF.");

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${category}/${Date.now()}-${safeName}`;
      const upload = await supabase.storage
        .from("technical-sheets")
        .upload(path, file, { contentType: "application/pdf", upsert: false });
      if (upload.error) throw upload.error;

      const tags = tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const { error } = await supabase.from("products").insert({
        name: name.trim(),
        supplier,
        category,
        tags,
        pdf_path: path,
        pdf_filename: file.name,
        url: url.trim() || null,
        created_by: user.id,
      });
      if (error) {
        await supabase.storage.from("technical-sheets").remove([path]);
        throw error;
      }
    },
    onSuccess: () => {
      toast.success("Produit ajouté.");
      reset();
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (p: { id: string; pdf_path: string | null }) => {
      if (p.pdf_path) {
        await supabase.storage.from("technical-sheets").remove([p.pdf_path]);
      }
      const { error } = await supabase.from("products").delete().eq("id", p.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Produit supprimé.");
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
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
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
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
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
                    <SelectTrigger className="flex-1"><SelectValue placeholder="Sélectionner" /></SelectTrigger>
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
              <Label>Fiche technique (PDF, max 5 Mo) *</Label>
              {!file ? (
                <div
                  {...getRootProps()}
                  className={`rounded-lg border-2 border-dashed transition cursor-pointer p-8 text-center ${
                    isDragActive
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/60 hover:bg-secondary/50"
                  }`}
                >
                  <input {...getInputProps()} />
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
                  <FileText className="h-6 w-6 text-accent shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">{file.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} Ko
                    </div>
                  </div>
                  <button
                    onClick={() => setFile(null)}
                    className="text-muted-foreground hover:text-foreground"
                    aria-label="Retirer"
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
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
              Catalogue
            </div>
            <h2 className="text-2xl font-bold tracking-tight">
              Produits enregistrés
              <span className="text-muted-foreground font-normal text-base ml-2">
                ({products.length})
              </span>
            </h2>
          </div>

          <div className="rounded-lg border border-border bg-card overflow-hidden">
            {products.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Aucun produit pour le moment.
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {products.map((p) => (
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
                        className="text-muted-foreground hover:text-accent"
                        aria-label="Modifier"
                      >
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Supprimer "${p.name}" ?`)) {
                            deleteMutation.mutate({ id: p.id, pdf_path: p.pdf_path });
                          }
                        }}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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