import { useState } from "react";
import { ExternalLink, Globe, AlertTriangle, Star, FileText, Pencil, Trash2 } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PdfViewerModal } from "@/components/PdfViewerModal";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useFavorites } from "@/hooks/use-favorites";
import { deleteNorm, removeNormPdf, type Norm } from "@/lib/norms";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const TAG_PALETTE = [
  "bg-[oklch(0.94_0.04_250)] text-[oklch(0.35_0.12_250)] border-[oklch(0.85_0.08_250)]",
  "bg-[oklch(0.95_0.05_55)] text-[oklch(0.4_0.12_55)] border-[oklch(0.85_0.1_55)]",
  "bg-[oklch(0.94_0.04_160)] text-[oklch(0.35_0.1_160)] border-[oklch(0.85_0.08_160)]",
  "bg-[oklch(0.95_0.03_300)] text-[oklch(0.4_0.1_300)] border-[oklch(0.85_0.08_300)]",
];
function tagClass(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) >>> 0;
  return TAG_PALETTE[h % TAG_PALETTE.length];
}

const FAV_PREFIX = "norm:";

export function NormCard({ norm, onEdit }: { norm: Norm; onEdit?: (norm: Norm) => void }) {
  const CategoryIcon = getCategoryIcon(norm.category);
  const { user } = useAuth();
  const qc = useQueryClient();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const favKey = FAV_PREFIX + norm.id;
  const favorite = isFavorite(favKey);
  const [favPulse, setFavPulse] = useState(false);

  const hasPdf = !!norm.pdf_path;
  const hasUrl = !!norm.url;

  const removeMutation = useMutation({
    mutationFn: async () => {
      if (norm.pdf_path) await removeNormPdf(norm.pdf_path).catch(() => {});
      await deleteNorm(norm.id);
    },
    onSuccess: () => {
      toast.success("Document supprimé");
      qc.invalidateQueries({ queryKey: ["norms"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur"),
  });

  const handlePrimary = () => {
    if (hasPdf) {
      const { data } = supabase.storage.from("technical-sheets").getPublicUrl(norm.pdf_path!);
      setPdfUrl(data.publicUrl);
      setPdfOpen(true);
    } else if (hasUrl) {
      window.open(norm.url!, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <article className="group relative rounded-xl border border-border bg-card p-4 md:p-5 shadow-sm transition hover:shadow-md hover:border-accent/40 hover:shadow-accent/10 flex flex-col h-full gap-3 md:gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-foreground/70 mb-1 flex items-center gap-1.5">
            <CategoryIcon className="h-3 w-3" />
            {norm.category}
          </div>
          <h3 className="font-bold text-foreground leading-tight text-lg">{norm.name}</h3>
          {norm.source && (
            <div className="text-sm font-medium text-foreground/75 mt-1 truncate">{norm.source}</div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            toggleFavorite(favKey);
            setFavPulse(true);
            window.setTimeout(() => setFavPulse(false), 350);
          }}
          aria-pressed={favorite}
          aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          className={`shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-md border transition-all duration-200 active:scale-90 ${
            favorite
              ? "border-[oklch(0.75_0.14_45)]/40 bg-[oklch(0.95_0.05_45)] text-[oklch(0.58_0.18_40)] dark:bg-[oklch(0.3_0.08_40)] dark:border-[oklch(0.5_0.14_45)]/40 dark:text-[oklch(0.78_0.16_45)]"
              : "border-border bg-secondary text-muted-foreground hover:text-[oklch(0.58_0.18_40)] hover:border-[oklch(0.75_0.14_45)]/40"
          } ${favPulse ? "scale-110" : ""}`}
        >
          <Star
            className={`h-4 w-4 transition-transform duration-300 ${favPulse ? "rotate-[18deg] scale-125" : ""}`}
            fill={favorite ? "currentColor" : "none"}
            strokeWidth={favorite ? 1.5 : 2}
          />
        </button>
      </div>

      {norm.domain && (
        <div className="text-xs text-muted-foreground">
          <span className="uppercase tracking-wider text-[10px] text-muted-foreground/60 mr-1.5">
            Domaine :
          </span>
          {norm.domain}
        </div>
      )}

      {norm.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {norm.tags.map((t) => (
            <Badge key={t} variant="outline" className={`${tagClass(t)} font-normal`}>
              {t}
            </Badge>
          ))}
        </div>
      )}

      {norm.note && norm.note.trim() && (
        <div className="rounded-md border border-[oklch(0.85_0.12_85)] bg-[oklch(0.97_0.05_85)] text-[oklch(0.35_0.1_60)] px-3 py-2 flex items-start gap-2 text-xs leading-relaxed dark:bg-[oklch(0.25_0.06_60)] dark:text-[oklch(0.85_0.1_75)] dark:border-[oklch(0.45_0.1_60)]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[oklch(0.55_0.15_60)] dark:text-[oklch(0.75_0.15_70)]" />
          <p className="whitespace-pre-wrap">{norm.note}</p>
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-border flex flex-col gap-3">
        <div className="flex gap-2 w-full">
          <Button
            size="sm"
            onClick={handlePrimary}
            disabled={!hasPdf && !hasUrl}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1"
          >
            {hasPdf ? "Ouvrir le document" : "Voir la source"}
            {hasPdf ? (
              <FileText className="h-3.5 w-3.5 ml-1.5" />
            ) : (
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            )}
          </Button>
          {hasPdf && hasUrl && (
            <a
              href={norm.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              Source en ligne
            </a>
          )}
        </div>

        {user && (
          <div className="flex items-center justify-end gap-1">
            {onEdit && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onEdit(norm)}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <Pencil className="h-3 w-3 mr-1" />
                Modifier
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="h-3 w-3 mr-1" />
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer ce document ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Cette action est définitive. Le PDF associé sera également supprimé.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={() => removeMutation.mutate()}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </div>

      <PdfViewerModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        productName={norm.name}
        pdfUrl={pdfUrl}
        pdfFilename={norm.pdf_filename ?? null}
      />
    </article>
  );
}