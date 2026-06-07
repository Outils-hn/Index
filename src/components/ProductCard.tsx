import { ExternalLink, FileText, Calendar, UserCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface Product {
  id: string;
  name: string;
  supplier: string;
  category: string;
  tags: string[];
  pdf_path: string | null;
  pdf_filename: string | null;
  url: string | null;
  updated_at: string;
  created_by: string | null;
  author?: {
    display_name: string | null;
    email: string | null;
    first_name: string | null;
    last_name: string | null;
  } | null;
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

export function ProductCard({ product }: { product: Product }) {
  const fullName = [product.author?.first_name, product.author?.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const authorLabel = fullName || product.author?.display_name || "Utilisateur supprimé";

  const openPdf = () => {
    if (!product.pdf_path) return;
    const { data } = supabase.storage.from("technical-sheets").getPublicUrl(product.pdf_path);
    window.open(data.publicUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <article className="group relative rounded-lg border border-border bg-card p-5 transition hover:border-accent/40 hover:shadow-lg hover:shadow-accent/5 flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground mb-1">
            {product.category}
          </div>
          <h3 className="font-bold text-foreground leading-tight text-lg">{product.name}</h3>
          <div className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
            <span className="truncate">{product.supplier}</span>
            {product.url && (
              <a
                href={product.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="text-muted-foreground/70 hover:text-accent transition-colors shrink-0"
                aria-label={`Site web de ${product.supplier}`}
                title="Ouvrir le site du fournisseur"
              >
                <Globe className="h-3.5 w-3.5" />
              </a>
            )}
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
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          {new Date(product.updated_at).toLocaleDateString("fr-FR", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </div>
        <Button
          size="sm"
          onClick={openPdf}
          disabled={!product.pdf_path}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          Ouvrir la fiche
          <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 -mt-2">
        <UserCircle2 className="h-3 w-3" />
        <span className="truncate">
          Ajouté par {authorLabel}
        </span>
      </div>
    </article>
  );
}