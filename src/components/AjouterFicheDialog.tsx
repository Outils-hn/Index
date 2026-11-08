import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { UploadCloud, FileText, Loader2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/use-auth";
import { fetchCategories, fetchSuppliers, createCategory, createSupplier } from "@/lib/taxonomies";
import { QuickAddDialog } from "@/components/QuickAddDialog";
import { ProjectsMultiSelect } from "@/components/ProjectsMultiSelect";
import { fetchProjects, setProductProjects } from "@/lib/projects";

const MAX_SIZE = 5 * 1024 * 1024;

/** Ajout d'une fiche technique, depuis la Bibliotheque (remplace l'ancienne page Administration). */
export function AjouterFicheDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [supplier, setSupplier] = useState<string>("");
  const [category, setCategory] = useState<string>("");
  const [tagsInput, setTagsInput] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);

  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: suppliers = [] } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const { data: projects = [] } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });

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
      toast.success("Fiche ajoutée.");
      reset();
      onOpenChange(false);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajouter une fiche technique</DialogTitle>
            <DialogDescription>Nom, fournisseur et catégorie sont obligatoires, avec un PDF ou le lien du produit.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="space-y-2">
              <Label htmlFor="add-name">Nom du produit *</Label>
              <Input
                id="add-name"
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
              <Label htmlFor="add-tags">Mots-clés / Tags</Label>
              <Input
                id="add-tags"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="étanchéité, polyuréthane, extérieur"
              />
              <p className="text-xs text-muted-foreground">Séparés par des virgules.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-url">Lien internet du produit (URL)</Label>
              <Input
                id="add-url"
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.fournisseur.com/produit"
              />
              <p className="text-xs text-muted-foreground">Optionnel.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="add-note">Note ou avertissement (facultatif)</Label>
              <Textarea
                id="add-note"
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
        </DialogContent>
      </Dialog>

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
    </>
  );
}
