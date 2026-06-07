import { ExternalLink, FileText, Calendar, UserCircle2, Globe, AlertTriangle, MapPin, Check, Loader2 } from "lucide-react";
import { getCategoryIcon } from "@/lib/category-icons";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Project } from "@/lib/projects";
import { useAuth } from "@/hooks/use-auth";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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
    mutationFn: async () => {
      const { error } = await supabase
        .from("products")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", product.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fiche revalidée");
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: unknown) => {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la validation");
    },
  });

  const handlePrimary = () => {
    if (hasPdf) {
      const { data } = supabase.storage.from("technical-sheets").getPublicUrl(product.pdf_path!);
      window.open(data.publicUrl, "_blank", "noopener,noreferrer");
    } else if (hasUrl) {
      window.open(product.url!, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <article className="group relative rounded-xl border border-border bg-card p-5 shadow-sm transition hover:border-accent/40 hover:shadow-md hover:shadow-accent/10 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
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
        <div className="h-10 w-10 rounded-md border border-border bg-secondary grid place-items-center text-muted-foreground shrink-0">
          <FileText className="h-5 w-5" />
        </div>
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

      <div className="flex items-center justify-between gap-3 pt-2 mt-auto border-t border-border">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5" />
            {new Date(product.updated_at).toLocaleDateString("fr-FR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
            <span
              className={`inline-block h-2 w-2 rounded-full ${vStyle.dot}`}
              title={`${vStyle.label}`}
            />
          </div>
          {user && validity !== "valid" && (
            <button
              type="button"
              onClick={() => revalidate.mutate()}
              disabled={revalidate.isPending}
              className="inline-flex items-center justify-center h-5 w-5 rounded-full border border-border bg-secondary text-muted-foreground hover:text-accent hover:border-accent/40 transition-colors disabled:opacity-50"
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
        <Button
          size="sm"
          onClick={handlePrimary}
          disabled={!hasPdf && !hasUrl}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          {hasPdf ? "Ouvrir la fiche" : "Voir sur le site"}
          {hasPdf ? (
            <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
          ) : (
            <Globe className="h-3.5 w-3.5 ml-1.5" />
          )}
        </Button>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 -mt-2">
        <UserCircle2 className="h-3 w-3" />
        <span className="truncate">
          Ajouté par {authorLabel}
        </span>
      </div>

      {product.note && product.note.trim() && (
        <div className="rounded-md border border-[oklch(0.85_0.12_85)] bg-[oklch(0.97_0.05_85)] text-[oklch(0.35_0.1_60)] px-3 py-2 flex items-start gap-2 text-xs leading-relaxed">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-[oklch(0.55_0.15_60)]" />
          <p className="whitespace-pre-wrap">{product.note}</p>
        </div>
      )}

      {product.projects && product.projects.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1 border-t border-border">
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
    </article>
  );
}