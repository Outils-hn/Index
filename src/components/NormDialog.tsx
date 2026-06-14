import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Upload, X, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createNorm,
  updateNorm,
  uploadNormPdf,
  removeNormPdf,
  fetchNormCategories,
  type Norm,
  type NormInput,
} from "@/lib/norms";
import { useAuth } from "@/hooks/use-auth";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  norm?: Norm | null;
}

export function NormDialog({ open, onOpenChange, norm }: Props) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const editing = !!norm;

  const { data: categories = [] } = useQuery({
    queryKey: ["norm_categories"],
    queryFn: fetchNormCategories,
  });

  const [name, setName] = useState("");
  const [source, setSource] = useState("");
  const [category, setCategory] = useState("");
  const [domain, setDomain] = useState("");
  const [tagsStr, setTagsStr] = useState("");
  const [url, setUrl] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [existingPdfPath, setExistingPdfPath] = useState<string | null>(null);
  const [existingPdfFilename, setExistingPdfFilename] = useState<string | null>(null);
  const [removePdf, setRemovePdf] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(norm?.name ?? "");
    setSource(norm?.source ?? "");
    setCategory(norm?.category ?? categories[0]?.name ?? "");
    setDomain(norm?.domain ?? "");
    setTagsStr((norm?.tags ?? []).join(", "));
    setUrl(norm?.url ?? "");
    setNote(norm?.note ?? "");
    setFile(null);
    setExistingPdfPath(norm?.pdf_path ?? null);
    setExistingPdfFilename(norm?.pdf_filename ?? null);
    setRemovePdf(false);
  }, [open, norm, categories]);

  const save = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Vous devez être connecté.");
      if (!name.trim()) throw new Error("Le nom est requis.");
      if (!category) throw new Error("La catégorie est requise.");

      let pdf_path = existingPdfPath;
      let pdf_filename = existingPdfFilename;

      if (removePdf && existingPdfPath) {
        await removeNormPdf(existingPdfPath).catch(() => {});
        pdf_path = null;
        pdf_filename = null;
      }

      if (file) {
        if (pdf_path) await removeNormPdf(pdf_path).catch(() => {});
        const up = await uploadNormPdf(file);
        pdf_path = up.path;
        pdf_filename = up.filename;
      }

      const tags = tagsStr
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean);

      const input: NormInput = {
        name: name.trim(),
        source: source.trim() || null,
        category,
        tags,
        domain: domain.trim() || null,
        pdf_path,
        pdf_filename,
        url: url.trim() || null,
        note: note.trim() || null,
      };

      if (editing && norm) await updateNorm(norm.id, input);
      else await createNorm(input, user.id);
    },
    onSuccess: () => {
      toast.success(editing ? "Document mis à jour" : "Document ajouté");
      qc.invalidateQueries({ queryKey: ["norms"] });
      onOpenChange(false);
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editing ? "Modifier le document" : "Ajouter un document"}</DialogTitle>
          <DialogDescription>
            Texte réglementaire : DTU, norme NF, règle professionnelle…
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="n-name">Nom / Référence *</Label>
            <Input
              id="n-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex. DTU 31.2 — Maisons à ossature bois"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="n-cat">Catégorie *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="n-cat">
                  <SelectValue placeholder="Sélectionner…" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="n-source">Organisme (optionnel)</Label>
              <Input
                id="n-source"
                value={source}
                onChange={(e) => setSource(e.target.value)}
                placeholder="AFNOR, CSTB…"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="n-domain">Domaine d'application</Label>
            <Input
              id="n-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="Façade, étanchéité, isolation…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="n-tags">Tags (séparés par virgules)</Label>
            <Input
              id="n-tags"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="bois, ITE, sismique…"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="n-url">URL externe (optionnel)</Label>
            <Input
              id="n-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Document PDF</Label>
            {existingPdfPath && !removePdf && !file && (
              <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-secondary px-3 py-2 text-sm">
                <span className="flex items-center gap-2 truncate text-muted-foreground">
                  <FileText className="h-4 w-4 shrink-0" />
                  <span className="truncate">{existingPdfFilename ?? "Document actuel"}</span>
                </span>
                <Button
                  size="sm"
                  variant="ghost"
                  type="button"
                  className="h-7 text-xs text-destructive hover:text-destructive"
                  onClick={() => setRemovePdf(true)}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Retirer
                </Button>
              </div>
            )}
            <Input
              id="n-file"
              type="file"
              accept="application/pdf"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
            <p className="text-xs text-muted-foreground">
              Optionnel : remplacez ou ajoutez un PDF. Sinon utilisez l'URL externe ci-dessus.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="n-note">Note d'alerte (optionnel)</Label>
            <Textarea
              id="n-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="Information importante affichée en jaune sur la carte…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                Enregistrement…
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-1.5" />
                {editing ? "Enregistrer" : "Ajouter"}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}