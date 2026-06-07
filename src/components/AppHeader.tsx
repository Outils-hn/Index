import { Link } from "@tanstack/react-router";
import { Layers } from "lucide-react";

export function AppHeader() {
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
            to="/admin"
            className="px-3 py-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition"
            activeProps={{ className: "px-3 py-2 rounded-md text-foreground bg-secondary" }}
          >
            Administration
          </Link>
        </nav>
      </div>
    </header>
  );
}