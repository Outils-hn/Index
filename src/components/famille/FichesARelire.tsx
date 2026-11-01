import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ExternalLink, Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Product } from "@/components/ProductCard";
import { checkedAt } from "@/lib/search";
import { aRelire, depuis, DOSE_DU_MOIS, verifieesCeMois } from "@/lib/verification";

/**
 * « Fiches a relire du mois » : les 5 fiches verifiees il y a le plus longtemps.
 * On ouvre la fiche (ou le site du fournisseur), on controle qu'elle est toujours la bonne,
 * puis « Toujours valable » remet sa date de verification a aujourd'hui ; la suivante prend sa place.
 */
export function FichesARelire({ products }: { products: Product[] }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const liste = aRelire(products);
  const faites = verifieesCeMois(products);
  const verifier = useMutation({
    mutationFn: async (p: Product) => {
      const { error } = await supabase.from("products").update({ verified_at: new Date().toISOString() }).eq("id", p.id);
      if (error) throw error;
      return p;
    },
    onSuccess: (p) => {
      toast.success(`« ${p.name} » vérifiée.`);
      qc.invalidateQueries({ queryKey: ["products"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const ouvrir = (p: Product) => {
    if (p.pdf_path) window.open(supabase.storage.from("technical-sheets").getPublicUrl(p.pdf_path).data.publicUrl, "_blank", "noopener,noreferrer");
    else if (p.url) window.open(p.url, "_blank", "noopener,noreferrer");
  };

  if (!liste.length && !faites) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted">
        <span className="h-1.5 w-1.5 rounded-full bg-[var(--app)]" aria-hidden="true" />
        Fiches à relire du mois
        <span className="num text-muted-foreground">{Math.min(faites, DOSE_DU_MOIS)}/{DOSE_DU_MOIS}</span>
      </button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-xl [&>*]:min-w-0">
          <DialogHeader>
            <DialogTitle>Fiches à relire du mois</DialogTitle>
            <DialogDescription>
              Les {DOSE_DU_MOIS} fiches vérifiées il y a le plus longtemps. Ouvrez-la, vérifiez qu'elle est toujours la dernière version
              du fournisseur (sinon remplacez le PDF dans Administration), puis cliquez « Toujours valable ».
            </DialogDescription>
          </DialogHeader>
          <p className="text-xs text-muted-foreground">
            Ce mois : <span className="num text-foreground">{faites}</span> fiche{faites > 1 ? "s" : ""} vérifiée{faites > 1 ? "s" : ""}
          </p>
          {liste.length ? (
            <ul className="divide-y divide-border rounded-lg border border-border">
              {liste.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 text-sm">
                  <div className="min-w-0 basis-full sm:basis-0 sm:flex-1">
                    <div className="truncate font-medium">{p.name}</div>
                    <div className="truncate text-xs text-muted-foreground">{p.supplier} · vérifiée {depuis(checkedAt(p))}</div>
                  </div>
                  <button type="button" onClick={() => ouvrir(p)} disabled={!p.pdf_path && !p.url} className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs hover:bg-muted disabled:opacity-40">
                    {p.pdf_path ? <ExternalLink className="h-3 w-3" aria-hidden="true" /> : <Globe className="h-3 w-3" aria-hidden="true" />}
                    {p.pdf_path ? "Fiche" : "Site"}
                  </button>
                  <button type="button" onClick={() => verifier.mutate(p)} disabled={verifier.isPending} className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50">
                    {verifier.isPending && verifier.variables?.id === p.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Toujours valable
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="rounded-lg border border-dashed border-border py-6 text-center text-sm text-muted-foreground">Toutes les fiches sont à jour. Rien à relire.</p>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
