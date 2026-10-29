import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { IndexMark } from "@/components/famille/IndexMark";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Connexion — Index" },
      { name: "description", content: "Connectez-vous pour gérer les fiches techniques." },
    ],
  }),
  component: AuthPage,
});

/**
 * Connexion et inscription des collegues. Un nouveau compte peut seulement consulter
 * tant qu'un collegue deja valide ne l'a pas valide (Configuration > Comptes).
 */
function AuthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user && mode === "signin") navigate({ to: "/admin" });
  }, [authLoading, user, navigate, mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "reset") {
        // Lien envoye par email ; il ouvre la page « Nouveau mot de passe »
        const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/nouveau-mot-de-passe` });
        if (error) throw error;
        toast.success("Si un compte existe pour cet email, un lien vient d'être envoyé.");
        setMode("signin");
        return;
      }
      if (mode === "signup") {
        const fn = firstName.trim(), ln = lastName.trim();
        if (!fn || !ln) throw new Error("Prénom et nom sont obligatoires.");
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { first_name: fn, last_name: ln, display_name: `${fn} ${ln}` },
          },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Compte créé. Un administrateur doit le valider avant que vous puissiez modifier des fiches.");
          navigate({ to: "/" });
        } else {
          toast.success("Compte créé : confirmez votre email, puis attendez la validation d'un collègue.");
          setMode("signin");
        }
        return;
      }
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Connexion réussie.");
      navigate({ to: "/admin" });
    } catch (err: any) {
      const m = err?.message ?? "";
      toast.error(/invalid login/i.test(m) ? "Email ou mot de passe incorrect." : /already registered/i.test(m) ? "Un compte existe déjà avec cet email." : /signups? not allowed|disabled/i.test(m) ? "Les inscriptions sont fermées pour le moment." : m || "Erreur de connexion.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="grid min-h-[80vh] place-items-center bg-background px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center justify-center gap-2.5">
          <IndexMark size={26} />
          <span className="text-xl font-semibold tracking-tight text-foreground">Index</span>
        </Link>
        <div className="rounded-lg border border-border bg-card p-6">
          <div className="mb-5 grid grid-cols-2 rounded-md bg-muted p-1 text-sm" role="tablist">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m || (m === "signin" && mode === "reset")}
                onClick={() => setMode(m)}
                className={`rounded px-3 py-1.5 transition-colors ${mode === m || (m === "signin" && mode === "reset") ? "bg-card font-medium text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {m === "signin" ? "Connexion" : "Créer un compte"}
              </button>
            ))}
          </div>
          <h1 className="sr-only">{mode === "signin" ? "Connexion" : mode === "reset" ? "Mot de passe oublié" : "Créer un compte"}</h1>
          <p className="mb-5 text-sm text-muted-foreground">
            {mode === "signin"
              ? "Pour ajouter et modifier des fiches."
              : mode === "reset"
                ? "Saisissez votre email : vous recevrez un lien pour choisir un nouveau mot de passe."
                : "Un administrateur validera votre compte ; en attendant, vous pouvez consulter la bibliothèque."}
          </p>
          <form onSubmit={submit} className="space-y-4">
            {mode === "signup" && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="firstName">Prénom</Label>
                  <Input id="firstName" required maxLength={50} autoComplete="given-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Nom</Label>
                  <Input id="lastName" required maxLength={50} autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="prenom.nom@bureau.ch" />
            </div>
            {mode !== "reset" && (
            <div className="space-y-2">
                <Label htmlFor="password">Mot de passe</Label>
                <Input id="password" type="password" autoComplete={mode === "signin" ? "current-password" : "new-password"} required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
            )}
            {mode === "signin" && (
              <button type="button" onClick={() => setMode("reset")} className="-mt-2 text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                Mot de passe oublié ?
              </button>
            )}
            <Button type="submit" disabled={loading} className="h-10 w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {mode === "signin" ? "Se connecter" : mode === "reset" ? "Envoyer le lien" : "Créer le compte"}
            </Button>
          </form>
        </div>
        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="transition hover:text-foreground">← Retour à la bibliothèque</Link>
        </p>
      </div>
    </main>
  );
}
