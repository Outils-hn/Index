import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { History } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { ask } from "@/lib/confirm";

/**
 * Configuration > Historique : tout ce qui a ete ajoute, modifie ou supprime dans les donnees communes
 * des applis (90 derniers jours). Un dessinateur annule seulement ses propres modifications ; un
 * administrateur annule tout sauf ce qu'a fait le concepteur ; le concepteur annule tout.
 * Le journal est tenu par la base (declencheurs) : les applis n'ont rien a faire.
 */
const TABLES: Record<string, string> = {
  products: "Fiche",
  categories: "Famille",
  suppliers: "Fournisseur",
  access_domaines: "Access · domaine",
  access_fournisseurs: "Access · fournisseur",
  format_materiaux: "Format · matériau",
  strate_catalogue: "Strate · catalogue",
  membrane_catalogue: "Membrane · catalogue",
  materials: "Masse · matériau",
  elements: "Masse · élément",
  lists: "Masse · liste",
};
const ACTIONS: Record<string, string> = { INSERT: "Ajout", UPDATE: "Modification", DELETE: "Suppression" };

const court = (v: unknown) => {
  const t = v === null || v === undefined ? "vide" : typeof v === "string" ? v || "vide" : JSON.stringify(v);
  return t.length > 40 ? t.slice(0, 40) + "…" : t;
};
const quand = (d: string) =>
  new Date(d).toLocaleString("fr-CH", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export function HistoriquePanel() {
  const qc = useQueryClient();
  const [tbl, setTbl] = useState("");
  const { data: lignes = [], error, isLoading } = useQuery({
    queryKey: ["historique", tbl],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("historique_lire", { _tbl: tbl || null, _limite: 100 });
      if (error) throw error;
      return data ?? [];
    },
    retry: 0,
  });
  const annuler = useMutation({
    mutationFn: async (id: number) => {
      const { error } = await supabase.rpc("historique_annuler", { _id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Modification annulée.");
      qc.invalidateQueries({ queryKey: ["historique"] });
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-5 py-4">
        <History className="h-4 w-4" aria-hidden="true" />
        <h2 className="font-semibold">Historique</h2>
        <span className="text-xs text-muted-foreground">90 derniers jours</span>
        <select
          aria-label="Filtrer par type"
          className="ml-auto rounded-md border border-border bg-background px-2 py-1 text-xs"
          value={tbl}
          onChange={(e) => setTbl(e.target.value)}
        >
          <option value="">Tout</option>
          {Object.entries(TABLES).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>
      {error ? (
        <p className="px-5 py-4 text-sm text-muted-foreground">
          L'historique n'est pas encore installé dans la base (script « historique » à exécuter dans Supabase).
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {lignes.map((h) => {
            const champs = h.diff ? Object.entries(h.diff) : [];
            return (
              <li key={h.id} className={`flex items-start gap-3 px-5 py-3 text-sm ${h.annule ? "opacity-60" : ""}`}>
                <div className="min-w-0 flex-1">
                  <div className="truncate">
                    <span className="font-medium">{h.libelle || "(sans nom)"}</span>{" "}
                    <span className="text-xs text-muted-foreground">
                      {TABLES[h.tbl] ?? h.tbl} · {h.est_annulation ? `Annulation (${ACTIONS[h.action].toLowerCase()})` : ACTIONS[h.action]}
                      {h.annule ? " · annulée" : ""}
                    </span>
                  </div>
                  {champs.length > 0 && (
                    <div className="truncate text-xs text-muted-foreground">
                      {champs.slice(0, 3).map(([k, [a, b]]) => `${k} : ${court(a)} → ${court(b)}`).join(" · ")}
                      {champs.length > 3 ? ` · +${champs.length - 3}` : ""}
                    </div>
                  )}
                  <div className="text-xs text-muted-foreground">
                    {h.auteur_nom} · <span className="num">{quand(h.at)}</span>
                  </div>
                </div>
                {h.peut_annuler && (
                  <button
                    className="shrink-0 rounded-md border border-border px-2.5 py-1 text-xs hover:bg-muted"
                    disabled={annuler.isPending}
                    onClick={async () => {
                      if (await ask({
                        title: `Annuler cette modification de « ${h.libelle || "(sans nom)"} » ?`,
                        message: "La ligne revient comme elle était avant. L'annulation s'inscrit aussi dans l'historique.",
                        confirm: "Annuler la modification",
                      })) annuler.mutate(h.id);
                    }}
                  >
                    Annuler
                  </button>
                )}
              </li>
            );
          })}
          {!lignes.length && !isLoading && <li className="px-5 py-4 text-sm text-muted-foreground">Rien à afficher.</li>}
        </ul>
      )}
    </section>
  );
}
