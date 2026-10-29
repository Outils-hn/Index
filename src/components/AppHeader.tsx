import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, LogIn } from "lucide-react";
import { useAuth, useApproval } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SelecteurApplis } from "@/components/famille/SelecteurApplis";
import { IndexMark } from "@/components/famille/IndexMark";

const NAV_LINK = "rounded-md px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground";
const NAV_ACTIVE = "rounded-md bg-muted px-3 py-1.5 text-sm font-medium text-foreground shadow-[inset_0_-2px_0_var(--app)]";

/** En-tete commun a la famille : logo + nom avec selecteur d'applis, onglets sobres, theme et compte a droite. */
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
    <header className="border-b border-border bg-background">
      <div className="mx-auto flex max-w-7xl items-center gap-6 px-6 py-3">
        <div className="flex items-center gap-2.5">
          <IndexMark />
          <SelecteurApplis />
          <span className="sr-only">Fiches techniques</span>
        </div>
        <nav aria-label="Sections" className="flex items-center gap-1">
          <Link to="/" className={NAV_LINK} activeProps={{ className: NAV_ACTIVE }} activeOptions={{ exact: true }}>
            Bibliothèque
          </Link>
          {user && approved && (
            <>
              <Link to="/admin" className={NAV_LINK} activeProps={{ className: NAV_ACTIVE }}>
                Administration
              </Link>
              <Link to="/config" className={NAV_LINK} activeProps={{ className: NAV_ACTIVE }}>
                Configuration
              </Link>
            </>
          )}
        </nav>
        <div className="ml-auto flex items-center gap-2 text-xs">
          {user ? (
            <>
              {!approved && (
                <span className="rounded-full border border-index/40 px-2 py-0.5 text-index" title="Un administrateur doit valider ce compte avant qu'il puisse modifier des fiches">
                  En attente de validation
                </span>
              )}
              <span className="max-w-[200px] truncate text-muted-foreground" title={user.email ?? ""}>{user.email}</span>
              <button onClick={logout} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground">
                <LogOut className="h-3.5 w-3.5" />
                Déconnexion
              </button>
            </>
          ) : (
            <Link to="/auth" className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1.5 text-foreground transition-colors hover:bg-muted">
              <LogIn className="h-3.5 w-3.5" />
              Connexion
            </Link>
          )}
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
