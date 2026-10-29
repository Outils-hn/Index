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
 * Connexion des collegues. L'inscription libre est fermee cote serveur :
 * les comptes sont crees par l'administrateur, d'ou l'absence d'onglet « Créer un compte ».
 */
function AuthPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && user) navigate({ to: "/admin" });
  }, [authLoading, user, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast.success("Connexion réussie.");
      navigate({ to: "/admin" });
    } catch (err: any) {
      toast.error(/invalid/i.test(err?.message ?? "") ? "Email ou mot de passe incorrect." : err?.message ?? "Erreur de connexion.");
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
          <h1 className="mb-1 text-base font-semibold">Connexion</h1>
          <p className="mb-5 text-sm text-muted-foreground">Pour ajouter et modifier des fiches. Pas de compte ? Demandez un accès à l'administrateur.</p>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" autoComplete="email" required autoFocus value={email} onChange={(e) => setEmail(e.target.value)} placeholder="vous@bureau.ch" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Mot de passe</Label>
              <Input id="password" type="password" autoComplete="current-password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <Button type="submit" disabled={loading} className="h-10 w-full">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Se connecter
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
