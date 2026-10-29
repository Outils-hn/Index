import { ExternalLink, Globe, MapPin, Check, Loader2, Star, TriangleAlert } from "lucide-react";
import { memo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { getCategoryIcon } from "@/lib/category-icons";
import { supabase } from "@/integrations/supabase/client";
import { PdfViewerModal } from "@/components/PdfViewerModal";
import type { Project } from "@/lib/projects";
import { useCompare } from "@/components/CompareContext";
import { checkedAt, validity, VALIDITY_LABEL, type Validity } from "@/lib/search";

export interface Product {
  id: string;
  name: string;
  supplier: string;
  category: string;
  category_icon?: string | null;
  tags: string[];
  pdf_path: string | null;
  pdf_filename: string | null;
  url: string | null;
  note: string | null;
  updated_at: string;
  /** Derniere verification de la fiche (colonne ajoutee en 2.0 ; absente avant la mise a jour de la base). */
  verified_at?: string | null;
  /** Mise a la corbeille (2.0) : la fiche reste restaurable 30 jours. */
  deleted_at?: string | null;
  created_at?: string;
  created_by: string | null;
  author?: {
    display_name: string | null;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
  projects?: Project[];
}

const DOT: Record<Validity, string> = { valid: "bg-ok", warn: "bg-warn", expired: "bg-bad" };
const TXT: Record<Validity, string> = { valid: "text-muted-foreground", warn: "text-warn", expired: "text-bad" };

export const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit", year: "numeric" });

/**
 * Carte d'une fiche, version epuree : nom, fournisseur, mots-cles, note, chantiers,
 * un bouton principal et une ligne de validite. Memorisee : la recherche ne redessine
 * que les cartes qui changent.
 */
export const ProductCard = memo(function ProductCard({
  product, loggedIn, favorite, onToggleFavorite,
}: {
  product: Product;
  loggedIn: boolean;
  favorite: boolean;
  onToggleFavorite: (id: string) => void;
}) {
  const CategoryIcon = getCategoryIcon(product.category, product.category_icon);
  const queryClient = useQueryClient();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const { isSelected, toggle } = useCompare();
  const selected = isSelected(product.id);

  const hasPdf = !!product.pdf_path;
  const hasUrl = !!product.url;
  const v = validity(product);

  // « Marquer comme verifiee » : nouvelle date de verification (colonne de la 2.0),
  // ou date de modification si la base n'a pas encore ete mise a jour
  const revalidate = useMutation({
    mutationFn: async () => {
      const at = new Date().toISOString();
      const r = await supabase.from("products").update({ verified_at: at }).eq("id", product.id);
      if (r.error) {
        const r2 = await supabase.from("products").update({ updated_at: at }).eq("id", product.id);
        if (r2.error) throw r2.error;
      }
    },
    onSuccess: () => {
      toast.success("Fiche marquée comme vérifiée aujourd'hui.");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : "Erreur lors de la vérification"),
  });

  const open = () => {
    if (hasPdf) {
      const { data } = supabase.storage.from("technical-sheets").getPublicUrl(product.pdf_path!);
      setPdfUrl(data.publicUrl);
      setPdfOpen(true);
    } else if (hasUrl) {
      window.open(product.url!, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <article className={`flex h-full flex-col gap-3 rounded-lg border bg-card p-4 transition-colors ${selected ? "border-index" : "border-border hover:border-foreground/25"}`}>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            <CategoryIcon className="h-3 w-3" aria-hidden="true" />
            {product.category}
          </div>
          <h3 className="text-base font-semibold leading-snug text-foreground">{product.name}</h3>
          <p className="text-sm text-muted-foreground">{product.supplier}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={() => toggle(product)}
            aria-pressed={selected}
            title="Ajouter à la comparaison"
            className={`rounded-md border px-2 py-1 text-[11px] font-medium transition-colors ${selected ? "border-index bg-index-soft text-index" : "border-border text-muted-foreground hover:text-foreground"}`}
          >
            {selected ? "Comparée" : "Comparer"}
          </button>
          <button
            type="button"
            onClick={() => onToggleFavorite(product.id)}
            aria-pressed={favorite}
            aria-label={favorite ? `Retirer ${product.name} des favoris` : `Ajouter ${product.name} aux favoris`}
            title={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
            className={`inline-flex h-7 w-7 items-center justify-center rounded-md transition-colors ${favorite ? "text-index" : "text-muted-foreground hover:text-foreground"}`}
          >
            <Star className="h-4 w-4" fill={favorite ? "currentColor" : "none"} />
          </button>
        </div>
      </div>

      {product.tags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {product.tags.map((t) => (
            <span key={t} className="rounded border border-border px-1.5 py-0.5 text-[11px] text-muted-foreground">{t}</span>
          ))}
        </div>
      )}

      {product.note?.trim() && (
        <p className="flex items-start gap-2 border-l-2 border-warn pl-2 text-xs leading-relaxed text-foreground">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-warn" aria-hidden="true" />
          <span className="whitespace-pre-wrap">{product.note}</span>
        </p>
      )}

      <div className="mt-auto flex flex-col gap-3">
        {product.projects && product.projects.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.projects.map((pr) => (
              <span key={pr.id} className="inline-flex items-center gap-1 rounded bg-muted px-1.5 py-0.5 text-[11px] text-foreground/80" title={`${pr.numero} — ${pr.nom}`}>
                <MapPin className="h-2.5 w-2.5" aria-hidden="true" />
                <span className="num">{pr.numero}</span>
                <span>{pr.nom}</span>
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-2 border-t border-border pt-3">
          <button
            type="button"
            onClick={open}
            disabled={!hasPdf && !hasUrl}
            className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {hasPdf ? "Ouvrir la fiche" : hasUrl ? "Voir sur le site" : "Aucune fiche"}
            {hasPdf ? <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" /> : <Globe className="h-3.5 w-3.5" aria-hidden="true" />}
          </button>
          {hasPdf && hasUrl && (
            <a
              href={product.url!}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-muted"
            >
              <Globe className="h-3.5 w-3.5" aria-hidden="true" />
              Site
            </a>
          )}
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${DOT[v]}`} aria-hidden="true" />
          <span className={TXT[v]}>
            {VALIDITY_LABEL[v]} · vérifiée le <span className="num">{fmtDate(checkedAt(product))}</span>
          </span>
          {loggedIn && v !== "valid" && (
            <button
              type="button"
              onClick={() => revalidate.mutate()}
              disabled={revalidate.isPending}
              className="ml-auto inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              title="Marquer la fiche comme vérifiée aujourd'hui"
            >
              {revalidate.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Vérifiée
            </button>
          )}
        </div>
      </div>

      {/* Lecteur monte seulement a l'ouverture : 400 cartes ne portent pas 400 fenetres fermees */}
      {pdfOpen && <PdfViewerModal open onClose={() => setPdfOpen(false)} productName={product.name} pdfUrl={pdfUrl} pdfFilename={product.pdf_filename} />}
    </article>
  );
});
