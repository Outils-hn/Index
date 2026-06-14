import { Link, useNavigate } from "@tanstack/react-router";
import { Layers, LogOut, LogIn, User, BookMarked } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const logout = async () => {
    await supabase.auth.signOut();
    toast.success("Déconnecté.");
    navigate({ to: "/" });
  };

  return (
    <header className="border-b border-border bg-card/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-7xl px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="h-9 w-9 rounded-md bg-primary text-primary-foreground grid place-items-center shadow-sm">
            <Layers className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">FaçadeTech</div>
            <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
              Fiches techniques · Bureau d'études
            </div>
          </div>
        </Link>
        <nav className="flex items-center gap-1 text-sm">
          <Link
            to="/"
            className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            activeProps={{ className: "px-3 py-2 rounded-md text-foreground bg-secondary" }}
            activeOptions={{ exact: true }}
          >
            Vue projeteur
          </Link>
          <Link
            to="/normes"
            className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition inline-flex items-center gap-1.5"
            activeProps={{
              className:
                "px-3 py-2 rounded-md text-foreground bg-secondary inline-flex items-center gap-1.5",
            }}
          >
            <BookMarked className="h-3.5 w-3.5" />
            Normes & Infos
          </Link>
          {user && (
            <>
              <Link
                to="/admin"
                className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                activeProps={{ className: "px-3 py-2 rounded-md text-foreground bg-secondary" }}
              >
                Administration
              </Link>
              <Link
                to="/config"
                className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
                activeProps={{ className: "px-3 py-2 rounded-md text-foreground bg-secondary" }}
              >
                Configuration
              </Link>
            </>
          )}
          <div className="ml-2 pl-3 border-l border-border flex items-center gap-2">
            <ThemeToggle />
            {user ? (
              <>
                <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                  <User className="h-3.5 w-3.5" />
                  <span className="max-w-[180px] truncate">{user.email}</span>
                </div>
                <Button size="sm" variant="ghost" onClick={logout}>
                  <LogOut className="h-4 w-4 sm:mr-1.5" />
                  <span className="hidden sm:inline">Déconnexion</span>
                </Button>
              </>
            ) : (
              <Button size="sm" asChild>
                <Link to="/auth">
                  <LogIn className="h-4 w-4 mr-1.5" />
                  Connexion
                </Link>
              </Button>
            )}
          </div>
        </nav>
      </div>
    </header>
  );
}