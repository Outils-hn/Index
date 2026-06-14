import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, SlidersHorizontal, LogIn, Eye, Star, Plus, LayoutGrid, BookMarked } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { NormCard } from "@/components/NormCard";
import { NormDialog } from "@/components/NormDialog";
import { fetchNorms, fetchNormCategories, type Norm } from "@/lib/norms";
import { getCategoryIcon } from "@/lib/category-icons";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useFavorites } from "@/hooks/use-favorites";

export const Route = createFileRoute("/normes")({
  head: () => ({
    meta: [
      { title: "Normes & Infos — FaçadeTech" },
      {
        name: "description",
        content:
          "Bibliothèque de textes réglementaires (DTU, normes NF, règles professionnelles) pour bureau d'études façade.",
      },
      { property: "og:title", content: "Normes & Infos — FaçadeTech" },
      {
        property: "og:description",
        content: "DTU, normes NF, règles professionnelles. Recherche et favoris.",
      },
    ],
  }),
  component: NormsPage,
});

function NormsPage() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Norm | null>(null);
  const { user } = useAuth();
  const { isFavorite } = useFavorites();

  const { data: norms = [], isLoading } = useQuery({
    queryKey: ["norms"],
    queryFn: fetchNorms,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["norm_categories"],
    queryFn: fetchNormCategories,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return norms.filter((n) => {
      if (favoritesOnly && !isFavorite("norm:" + n.id)) return false;
      if (category && n.category !== category) return false;
      if (!q) return true;
      return (
        n.name.toLowerCase().includes(q) ||
        (n.source ?? "").toLowerCase().includes(q) ||
        (n.domain ?? "").toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [norms, search, category, favoritesOnly, isFavorite]);

  const openAdd = () => {
    setEditing(null);
    setDialogOpen(true);
  };
  const openEdit = (n: Norm) => {
    setEditing(n);
    setDialogOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-4 md:px-6 py-4 md:py-10">
        <div className="mb-5 md:mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1 flex items-center gap-1.5">
                <BookMarked className="h-3 w-3" />
                Normes & Infos
              </div>
              <h1 className="text-xl md:text-3xl font-bold tracking-tight text-foreground">
                Textes réglementaires
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-1.5">
                DTU, normes NF, règles professionnelles. Recherchez par nom, organisme, domaine ou tag.
              </p>
            </div>
            {user ? (
              <Button onClick={openAdd}>
                <Plus className="h-4 w-4" />
                Ajouter un document
              </Button>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/60 border border-border rounded-md px-3 py-2">
                <Eye className="h-3.5 w-3.5" />
                Mode lecture seule —{" "}
                <Link to="/auth" className="text-foreground font-medium hover:underline inline-flex items-center gap-1">
                  <LogIn className="h-3 w-3" /> Se connecter
                </Link>
              </div>
            )}
          </div>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un DTU, une norme, un domaine, un tag…"
            className="pl-11 pr-11 h-12 text-base bg-card border-border focus-visible:ring-accent"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Effacer"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="flex md:flex-wrap items-center gap-2 mb-6 md:mb-8 flex-nowrap overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4 md:mx-0 md:px-0 md:overflow-visible">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-muted-foreground mr-2 shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Catégories
          </div>
          <Button
            size="sm"
            variant={category === null ? "default" : "outline"}
            onClick={() => setCategory(null)}
            className="shrink-0"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Toutes
          </Button>
          <Button
            size="sm"
            variant={favoritesOnly ? "default" : "outline"}
            onClick={() => setFavoritesOnly((v) => !v)}
            className={`shrink-0 ${
              favoritesOnly
                ? "bg-[oklch(0.62_0.16_40)] hover:bg-[oklch(0.58_0.17_40)] text-white border-transparent"
                : "text-[oklch(0.5_0.16_40)] hover:text-[oklch(0.45_0.18_40)] hover:border-[oklch(0.7_0.14_45)]/50"
            }`}
            aria-pressed={favoritesOnly}
          >
            <Star className="h-3.5 w-3.5" fill={favoritesOnly ? "currentColor" : "none"} />
            Mes Favoris
          </Button>
          {categories.map((c) => {
            const Icon = getCategoryIcon(c.name, c.icon);
            return (
              <Button
                key={c.id}
                size="sm"
                variant={category === c.name ? "default" : "outline"}
                onClick={() => setCategory(c.name)}
                className="shrink-0"
              >
                <Icon className="h-3.5 w-3.5" />
                {c.name}
              </Button>
            );
          })}
        </div>

        <div className="text-sm text-muted-foreground mb-4">
          {isLoading
            ? "Chargement…"
            : `${filtered.length} document${filtered.length > 1 ? "s" : ""}`}
        </div>

        {!isLoading && filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 py-16 text-center">
            {favoritesOnly ? (
              <div className="text-sm text-muted-foreground">
                Aucun document dans vos favoris pour le moment.
              </div>
            ) : (
              <>
                <div className="text-foreground font-medium">Aucun résultat</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Essayez d'autres mots-clés{user ? " ou ajoutez un nouveau document." : "."}
                </div>
              </>
            )}
          </div>
        ) : (
          <div className="grid gap-4 auto-rows-fr sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((n) => (
              <NormCard key={n.id} norm={n} onEdit={user ? openEdit : undefined} />
            ))}
          </div>
        )}
      </main>
      <NormDialog open={dialogOpen} onOpenChange={setDialogOpen} norm={editing} />
    </div>
  );
}