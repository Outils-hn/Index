import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { IndexMark } from "@/components/famille/IndexMark";

export const Route = createFileRoute("/nouveau-mot-de-passe")({
  head: () => ({ meta: [{ title: "Nouveau mot de passe — Index" }] }),
  component: NouveauMotDePasse,
});

/**
 * Page ouverte depuis le lien « Mot de passe oublié » recu par email :
 * le lien connecte temporairement le compte, on choisit ici le nouveau mot de passe.
 */
function NouveauMotDePasse() {
  const navigate = useNavigate();
  const [pret, setPret] = useState<"attente" | "ok" | "invalide">("attente");
  const [mdp, setMdp] = useState("");
  const [mdp2, setMdp2] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Le client Supabase lit le jeton du lien tout seul ; on attend la session qu'il ouvre
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "PASSWORD_RECOVERY" || s) setPret("ok");
    });
    supabase.auth.getSession().then(({ data }) => { if (data.session) setPret("ok"); });
    // Lien expire, deja utilise ou page ouverte sans lien
    const t = setTimeout(() => setPret((p) => (p === "attente" ? "invalide" : p)), 4000);
    return () => { sub.subscription.unsubscribe(); clearTimeout(t); };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mdp.length < 6) { toast.error("Au moins 6 caractères."); return; }
    if (mdp !== mdp2) { toast.error("Les deux mots de passe ne sont pas identiques."); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: mdp });
    setLoading(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Mot de passe changé.");
    navigate({ to: "/admin" });
  };

  return (
    <main className="grid min-h-[80vh] place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <IndexMark size={26} />
          <span className="text-xl font-semibold tracking-tight text-foreground">Index</span>
        </Link>
        <div className="rounded-lg border border-border bg-card p-6">
          <h1 className="mb-1 text-base font-semibold">Nouveau mot de passe</h1>
          {pret === "attente" && <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Vérification du lien…</p>}
          {pret === "invalide" && (
            <p className="text-sm text-muted-foreground">
              Ce lien n'est plus valable (déjà utilisé ou expiré).{" "}
              <Link to="/auth" className="text-foreground underline-offset-2 hover:underline">Redemander un lien</Link>
            </p>
          )}
          {pret === "ok" && (
            <form onSubmit={submit} className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="mdp">Nouveau mot de passe</Label>
                <Input id="mdp" type="password" autoComplete="new-password" required minLength={6} autoFocus value={mdp} onChange={(e) => setMdp(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="mdp2">Confirmer</Label>
                <Input id="mdp2" type="password" autoComplete="new-password" required minLength={6} value={mdp2} onChange={(e) => setMdp2(e.target.value)} />
              </div>
              <Button type="submit" disabled={loading} className="h-10 w-full">
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Enregistrer
              </Button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
