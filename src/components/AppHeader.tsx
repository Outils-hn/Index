import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, LogIn } from "lucide-react";
import { useAuth, useApproval } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SelecteurApplis } from "@/components/famille/SelecteurApplis";
import { IndexMark } from "@/components/famille/IndexMark";
import { Bandeau } from "@/components/famille/Bandeau";

/** En-tete : bandeau commun de la famille (logo + selecteur, onglets, compte, theme). */
export function AppHeader() {
  const { user } = useAuth();
  const { approved } = useApproval(user);
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnecté.");
    navigate({ to: "/" });
  };

  return (
    <Bandeau
      marque={<>
        <IndexMark />
        <SelecteurApplis />
        <span className="sr-only">Fiches techniques</span>
      </>}
      onglets={<>
        <Link to="/" className="bandeau-onglet" activeOptions={{ exact: true }}>Bibliothèque</Link>
        {user && approved && (
          <>
            <Link to="/admin" className="bandeau-onglet">Administration</Link>
            <Link to="/config" className="bandeau-onglet">Configuration</Link>
          </>
        )}
      </>}
      statut={user ? (
        <>
          {!approved && (
            <span className="bandeau-statut" title="Un administrateur doit valider ce compte avant qu'il puisse modifier des fiches">En attente de validation</span>
          )}
          <span className="bandeau-statut ouvert" title={user.email ?? ""}>{user.email}</span>
          <button onClick={logout} className="bandeau-btn"><LogOut /> Déconnexion</button>
        </>
      ) : (
        <>
          <span className="bandeau-statut">Lecture seule</span>
          <Link to="/auth" className="bandeau-btn"><LogIn /> Se connecter</Link>
        </>
      )}
      theme={<ThemeToggle />}
    />
  );
}
