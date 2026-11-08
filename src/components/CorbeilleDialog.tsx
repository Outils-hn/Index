import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { fmtDate, type Product } from "@/components/ProductCard";
import { useCorbeille } from "@/lib/corbeille";
import { ask } from "@/lib/confirm";

/** Fiches mises a la corbeille : restaurer ou supprimer pour de bon. */
export function CorbeilleDialog({ fiches, open, onOpenChange }: { fiches: Product[]; open: boolean; onOpenChange: (o: boolean) => void }) {
  const { trash, purge } = useCorbeille();
  const triees = [...fiches].sort((a, b) => (b.deleted_at ?? "").localeCompare(a.deleted_at ?? ""));
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Corbeille ({triees.length})</DialogTitle>
          <DialogDescription>Les fiches supprimées restent restaurables pendant 30 jours.</DialogDescription>
        </DialogHeader>
        {triees.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">La corbeille est vide.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {triees.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
                <div className="min-w-0 flex-1">
                  <div className="truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground">{p.supplier} · supprimée le <span className="num">{fmtDate(p.deleted_at!)}</span></div>
                </div>
                <button className="rounded-md border border-border px-2.5 py-2 text-xs hover:bg-muted sm:py-1" onClick={() => trash.mutate({ id: p.id, back: true })}>
                  Restaurer
                </button>
                <button
                  className="rounded-md px-2.5 py-2 text-xs text-destructive hover:bg-destructive/10 sm:py-1"
                  onClick={async () => {
                    if (await ask({ title: `Supprimer définitivement « ${p.name} » ?`, message: "La fiche et son PDF seront effacés. Impossible de revenir en arrière.", confirm: "Supprimer définitivement", danger: true })) {
                      purge.mutate({ id: p.id, pdf_path: p.pdf_path });
                    }
                  }}
                >
                  Supprimer définitivement
                </button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
