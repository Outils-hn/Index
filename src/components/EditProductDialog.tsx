import { useCallback, useEffect, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Loader2, UploadCloud, X, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchCategories,
  fetchSuppliers,
  createCategory,
  createSupplier,
} from "@/lib/taxonomies";
import { QuickAddDialog } from "@/components/QuickAddDialog";
import { ProjectsMultiSelect } from "@/components/ProjectsMultiSelect";
import { fetchProjects, setProductProjects } from "@/lib/projects";
import type { Product } from "@/components/ProductCard";

const MAX_SIZE = 5 * 1024 * 1024;

interface Props {
  product: Product | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function EditProductDialog({ product, open, onOpenChange }: Props) {
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [supplier, setSupplier] = useState("");
  const [category, setCategory] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

  useEffect(() => {
    if (product && open) {
      setName(product.name);
      setSupplier(product.supplier);
      setCategory(product.category);
      setTagsInput(product.tags.join(", "));
      setUrl(product.url ?? "");
      setNote(product.note ?? "");
      setNewFile(null);
      setSelectedProjects((product.projects ?? []).map((p) => p.id));
    }
  }, [product, open]);

  const onDrop = useCallback((accepted: File[], rejected: any[]) => {
    if (rejected.length > 0) {
      const r = rejected[0];
      if (r.errors?.[0]?.code === "file-too-large") toast.error("Le fichier dépasse 5 Mo.");
      else if (r.errors?.[0]?.code === "file-invalid-type") toast.error("Seuls les PDF sont acceptés.");
      else toast.error("Fichier refusé.");
      return;
    }
    if (accepted[0]) setNewFile(accepted[0]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { "application/pdf": [".pdf"] },
    maxSize: MAX_SIZE,
    multiple: false,
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!product) throw new Error("Aucun produit.");
      if (!name.trim() || !supplier || !category) {
        throw new Error("Merci de remplir tous les champs requis.");
      }

      let pdf_path = product.pdf_path;
      let pdf_filename = product.pdf_filename;

      if (newFile) {
        const safeName = newFile.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${category}/${Date.now()}-${safeName}`;
        const upload = await supabase.storage
          .from("technical-sheets")
          .upload(path, newFile, { contentType: "application/pdf", upsert: false });
        if (upload.error) throw upload.error;
        // remove old file
        if (product.pdf_path) {
          await supabase.storage.from("technical-sheets").remove([product.pdf_path]);
        }
        pdf_path = path;
        pdf_filename = newFile.name;
      }

      const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);

      const { error } = await supabase
        .from("products")
        .update({
          name: name.trim(),
          supplier,
          category,
          tags,
          url: url.trim() || null,
          note: note.trim() || null,
          pdf_path,
          pdf_filename,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);
      if (error) throw error;
      await setProductProjects(product.id, selectedProjects);
    },
    onSuccess: () => {
      toast.success("Produit mis à jour.");
      qc.invalidateQueries({ queryKey: ["products"] });
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifier le produit</DialogTitle>
          <DialogDescription>
            Mettez à jour les informations puis enregistrez.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Nom du produit *</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
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
                <Button type="button" size="icon" variant="outline" onClick={() => setSupplierDialogOpen(true)}>
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
                <Button type="button" size="icon" variant="outline" onClick={() => setCategoryDialogOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-tags">Mots-clés / Tags</Label>
            <Input
              id="edit-tags"
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="étanchéité, polyuréthane"
            />
            <p className="text-xs text-muted-foreground">Séparés par des virgules.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-url">Lien internet du produit (URL)</Label>
            <Input
              id="edit-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-note">Note ou avertissement (facultatif)</Label>
            <Textarea
              id="edit-note"
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
            <Label>Fiche technique (PDF)</Label>
            {newFile ? (
              <div className="rounded-lg border border-border bg-secondary/40 p-3 flex items-center gap-3">
                <FileText className="h-5 w-5 text-accent shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{newFile.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Nouveau · {(newFile.size / 1024).toFixed(0)} Ko — remplacera l'ancien
                  </div>
                </div>
                <button
                  onClick={() => setNewFile(null)}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Annuler"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <>
                <div className="rounded-lg border border-border bg-secondary/30 p-3 flex items-center gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium truncate">
                      {product?.pdf_filename ?? "Aucun PDF"}
                    </div>
                    <div className="text-xs text-muted-foreground">PDF actuel</div>
                  </div>
                </div>
                <div
                  {...getRootProps()}
                  className={`rounded-lg border-2 border-dashed transition cursor-pointer p-4 text-center ${
                    isDragActive
                      ? "border-accent bg-accent/5"
                      : "border-border hover:border-accent/60 hover:bg-secondary/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  <UploadCloud className="h-6 w-6 mx-auto text-muted-foreground mb-1" />
                  <div className="text-xs text-muted-foreground">
                    {isDragActive ? "Déposez ici" : "Glisser un nouveau PDF pour remplacer"}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
          <Button
            onClick={() => updateMutation.mutate()}
            disabled={updateMutation.isPending}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Enregistrer les modifications
          </Button>
        </DialogFooter>

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
      </DialogContent>
    </Dialog>
  );
}