import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { ask } from "@/lib/confirm";
import { fmtDate } from "@/components/ProductCard";

/**
 * Configuration > Comptes : les nouveaux comptes attendent ici qu'un collegue valide les accepte.
 * Valider = pouvoir ajouter, modifier, supprimer des fiches et voir les chantiers.
 */
export function ComptesPanel() {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { data: comptes = [], error } = useQuery({
    queryKey: ["accounts"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_accounts");
      if (error) throw error;
      return data ?? [];
    },
    retry: 0,
  });
  const set = useMutation({
    mutationFn: async ({ id, ok }: { id: string; ok: boolean }) => {
      const { error } = await supabase.rpc("set_account_approved", { _id: id, _approved: ok });
      if (error) throw error;
      return ok;
    },
    onSuccess: (ok) => {
      toast.success(ok ? "Compte validé." : "Accès retiré : le compte peut seulement consulter.");
      qc.invalidateQueries({ queryKey: ["accounts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });
  const enAttente = comptes.filter((c) => !c.approved).length;

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-5 py-4">
        <Users className="h-4 w-4" aria-hidden="true" />
        <h2 className="font-semibold">Comptes</h2>
        {enAttente > 0 && <span className="rounded-full bg-index-soft px-2 py-0.5 text-xs text-index">{enAttente} en attente</span>}
      </div>
      {error ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          La validation des comptes n'est pas encore installée dans la base (mise à jour à exécuter dans Lovable).
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {comptes.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-5 py-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="truncate">{c.display_name || c.email}</div>
                <div className="truncate text-xs text-muted-foreground">{c.email} · créé le <span className="num">{fmtDate(c.created_at)}</span></div>
              </div>
              {c.approved ? (
                <>
                  <span className="text-xs text-muted-foreground">Validé</span>
                  {c.id !== user?.id && (
                    <button
                      className="rounded-md px-2.5 py-1 text-xs text-destructive hover:bg-destructive/10"
                      onClick={async () => {
                        if (await ask({ title: `Retirer l'accès de ${c.display_name || c.email} ?`, message: "Le compte pourra encore consulter la bibliothèque, mais plus rien modifier.", confirm: "Retirer l'accès", danger: true })) {
                          set.mutate({ id: c.id, ok: false });
                        }
                      }}
                    >
                      Retirer
                    </button>
                  )}
                </>
              ) : (
                <button className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90" onClick={() => set.mutate({ id: c.id, ok: true })}>
                  Valider
                </button>
              )}
            </li>
          ))}
          {!comptes.length && <li className="px-5 py-4 text-sm text-muted-foreground">Aucun compte.</li>}
        </ul>
      )}
    </section>
  );
}
