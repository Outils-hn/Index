import { lazy, Suspense, useState } from "react";
import { GitCompare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCompare, MAX_COMPARE } from "@/components/CompareContext";
// Fenetre de comparaison chargee a la premiere ouverture seulement
const CompareModal = lazy(() => import("@/components/CompareModal").then((m) => ({ default: m.CompareModal })));

export function CompareBar() {
  const { selected, clear } = useCompare();
  const [open, setOpen] = useState(false);

  if (selected.length === 0) return null;

  return (
    <>
      <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3 pointer-events-none">
        <div className="mx-auto max-w-4xl pointer-events-auto">
          <div className="rounded-xl border border-border bg-card/90 backdrop-blur-xl shadow-2xl shadow-black/20 px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 text-sm">
              <span className="inline-flex items-center justify-center h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {selected.length}
              </span>
              <span className="text-foreground font-medium">
                produit{selected.length > 1 ? "s" : ""} sélectionné{selected.length > 1 ? "s" : ""} pour comparaison
              </span>
              <span className="text-xs text-muted-foreground hidden sm:inline">
                (max {MAX_COMPARE})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={clear}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5 mr-1" />
                Annuler
              </Button>
              <Button
                size="sm"
                onClick={() => setOpen(true)}
                disabled={selected.length < 2}
                className="bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <GitCompare className="h-3.5 w-3.5 mr-1.5" />
                Comparer les produits
              </Button>
            </div>
          </div>
        </div>
      </div>

      {open && <Suspense fallback={null}><CompareModal open onClose={() => setOpen(false)} products={selected} /></Suspense>}
    </>
  );
}