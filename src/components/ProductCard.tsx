import { ExternalLink, Calendar, UserCircle2, Globe, AlertTriangle, MapPin, Check, Loader2, Star } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PdfViewerModal } from "@/components/PdfViewerModal";
import type { Project } from "@/lib/projects";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
import { useCompare } from "@/components/CompareContext";
import { useFavorites } from "@/hooks/use-favorites";

export interface Product {
  id: string;
  name: string;
  supplier: string;
  category: string;
  tags: string[];
  pdf_path: string | null;
  pdf_filename: string | null;
  url: string | null;
  note: string | null;
  updated_at: string;
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

type Validity = "valid" | "warn" | "expired";

function getValidity(updatedAt: string): Validity {
  const months = (Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
  if (months < 12) return "valid";
  if (months < 24) return "warn";
  return "expired";
}

const VALIDITY_STYLES: Record<Validity, { label: string; pill: string; dot: string }> = {
  valid: {
    label: "Validé",
    pill: "bg-[oklch(0.95_0.05_150)] text-[oklch(0.38_0.12_150)] border-[oklch(0.82_0.1_150)]",
    dot: "bg-[oklch(0.6_0.18_150)] shadow-[0_0_6px_oklch(0.65_0.2_150)]",
  },
  warn: {
    label: "À vérifier",
    pill: "bg-[oklch(0.96_0.07_75)] text-[oklch(0.42_0.13_60)] border-[oklch(0.83_0.12_75)]",
    dot: "bg-[oklch(0.7_0.17_70)] shadow-[0_0_6px_oklch(0.75_0.18_70)]",
  },
  expired: {
    label: "Expiré",
    pill: "bg-[oklch(0.95_0.05_25)] text-[oklch(0.42_0.16_28)] border-[oklch(0.82_0.12_28)]",
    dot: "bg-[oklch(0.6_0.2_28)] shadow-[0_0_6px_oklch(0.65_0.22_28)]",
  },
};

export function ProductCard({ product }: { product: Product }) {
  const CategoryIcon = getCategoryIcon(product.category);
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState("");
  const { isSelected, toggle } = useCompare();
  const selected = isSelected(product.id);
  const { isFavorite, toggle: toggleFavorite } = useFavorites();
  const favorite = isFavorite(product.id);
  const [favPulse, setFavPulse] = useState(false);

  const fullName = [product.author?.first_name, product.author?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const authorLabel = fullName || product.author?.display_name || "Utilisateur supprimé";

  const hasPdf = !!product.pdf_path;
  const hasUrl = !!product.url;

  const validity = getValidity(product.updated_at);
  const vStyle = VALIDITY_STYLES[validity];

  const revalidate = useMutation({
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-foreground/70 mb-1 flex items-center gap-1.5">
            <CategoryIcon className="h-3 w-3" />
            {product.category}
          </div>
          <h3 className="font-bold text-foreground leading-tight text-lg">{product.name}</h3>
          <div className="text-sm font-medium text-foreground/75 mt-1">
            <span className="truncate">{product.supplier}</span>
          </div>
        </div>
        <label
          className={`shrink-0 inline-flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-[11px] font-medium cursor-pointer transition-colors ${
            selected
              ? "border-primary/50 bg-primary/10 text-primary"
              : "border-border bg-secondary text-muted-foreground hover:text-foreground hover:border-accent/40"
          }`}
          title="Sélectionner pour comparer"
        >
          <Checkbox
            checked={selected}
            onCheckedChange={() => toggle(product)}
            className="h-3.5 w-3.5"
          />
          Comparer
        </label>
        <button
          type="button"
          onClick={() => {
            toggleFavorite(product.id);
            setFavPulse(true);
            window.setTimeout(() => setFavPulse(false), 350);
          }}
          aria-pressed={favorite}
          aria-label={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
          title={favorite ? "Retirer des favoris" : "Ajouter aux favoris"}
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

      {product.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {product.tags.map((t) => (
            <Badge key={t} variant="outline" className={`${tagClass(t)} font-normal`}>
              {t}
            </Badge>
          ))}
        </div>
      )}

      {product.note && product.note.trim() && (
        <div className="rounded-md border border-[oklch(0.85_0.12_85)] bg-[oklch(0.97_0.05_85)] text-[oklch(0.35_0.1_60)] px-3 py-2 flex items-start gap-2 text-xs leading-relaxed">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[oklch(0.55_0.15_60)]" />
          <p className="whitespace-pre-wrap">{product.note}</p>
        </div>
      )}

      <div className="mt-auto pt-3 border-t border-border flex flex-col gap-3">
        {/* Boutons côte à côte */}
        <div className="flex gap-2 w-full">
          <Button
            size="sm"
            onClick={handlePrimary}
            disabled={!hasPdf && !hasUrl}
            className="bg-primary hover:bg-primary/90 text-primary-foreground flex-1"
          >
            {hasPdf ? "Ouvrir la fiche" : "Voir sur le site"}
            {hasPdf ? (
              <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            ) : (
              <Globe className="h-3.5 w-3.5 ml-1.5" />
            )}
          </Button>
          {hasPdf && hasUrl && (
            <a
              href={product.url!}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-3 py-2 text-xs font-medium text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors"
            >
              <Globe className="h-3.5 w-3.5" />
              Site fournisseur
            </a>
          )}
        </div>

        {product.projects && product.projects.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.projects.map((pr) => (
              <span
                key={pr.id}
                className="inline-flex items-center gap-1 rounded-full bg-secondary text-foreground/70 text-[10px] px-2 py-0.5 border border-border"
                title={`${pr.numero} — ${pr.nom}`}
              >
                <MapPin className="h-2.5 w-2.5" />
                <span className="font-mono">{pr.numero}</span>
                <span>{pr.nom}</span>
              </span>
            ))}
          </div>
        )}

        {/* Ligne fusionnée Date + Auteur tout en bas */}
        <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground/80">
          <div className="flex items-center gap-1.5 min-w-0 flex-1">
            <UserCircle2 className="h-3 w-3 shrink-0" />
            <span className="truncate">Ajouté par {authorLabel}</span>
            <span className="text-muted-foreground/40 shrink-0">•</span>
            <Calendar className="h-3 w-3 shrink-0" />
            <span className="truncate">
              {new Date(product.updated_at).toLocaleDateString("fr-FR", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            <span
              className={`inline-block h-2 w-2 rounded-full shrink-0 ml-1 mr-0.5 ${vStyle.dot}`}
              title={`${vStyle.label}`}
            />
          </div>
          {user && validity !== "valid" && (
            <button
              type="button"
              onClick={() => revalidate.mutate()}
              disabled={revalidate.isPending}
              className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-border bg-secondary text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors disabled:opacity-50 shrink-0 ml-2"
              title="Marquer la fiche comme vérifiée aujourd'hui"
              aria-label="Revalider la fiche"
            >
              {revalidate.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Check className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>

      <PdfViewerModal
        open={pdfOpen}
        onClose={() => setPdfOpen(false)}
        productName={product.name}
        pdfUrl={pdfUrl}
        pdfFilename={product.pdf_filename}
      />
    </article>
  );
}