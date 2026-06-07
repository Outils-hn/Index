import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, SlidersHorizontal, LogIn, Eye } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProductCard } from "@/components/ProductCard";
import { fetchCategories } from "@/lib/taxonomies";
import { getCategoryIcon } from "@/lib/category-icons";
import { LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { fetchProductsWithAuthors } from "@/lib/products";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FaçadeTech — Bibliothèque de fiches techniques" },
      { name: "description", content: "Recherche rapide de fiches techniques produits pour bureau d'études façade." },
      { property: "og:title", content: "FaçadeTech — Fiches techniques" },
      { property: "og:description", content: "Bibliothèque produits pour bureau d'études façade architecturale." },
    ],
  }),
  component: Index,
});

function Index() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const { user } = useAuth();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProductsWithAuthors,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (category && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.supplier.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
      );
    });
  }, [products, search, category]);

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-7xl px-6 py-10">
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                Bibliothèque de fiches techniques
              </h1>
              <p className="text-muted-foreground mt-1.5">
                Recherchez un produit par nom, fournisseur ou mot-clé.
              </p>
            </div>
            {!user && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground bg-secondary/60 border border-border rounded-md px-3 py-2">
                <Eye className="h-3.5 w-3.5" />
                Mode lecture seule —{" "}
                <Link to="/auth" className="text-foreground font-medium hover:underline inline-flex items-center gap-1">
                  <LogIn className="h-3 w-3" /> Se connecter
                </Link>{" "}
                pour ajouter des produits.
              </div>
            )}
          </div>
        </div>

        <div className="relative mb-5">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un produit, fournisseur, tag…"
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

        <div className="flex flex-wrap items-center gap-2 mb-8">
          <div className="flex items-center gap-1.5 text-xs uppercase tracking-[0.16em] text-muted-foreground mr-2">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Catégories
          </div>
          <Button
            size="sm"
            variant={category === null ? "default" : "outline"}
            onClick={() => setCategory(null)}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Toutes
          </Button>
          {categories.map((c) => {
            const Icon = getCategoryIcon(c.icon);
            return (
              <Button
                key={c.id}
                size="sm"
                variant={category === c.name ? "default" : "outline"}
                onClick={() => setCategory(c.name)}
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
            : `${filtered.length} produit${filtered.length > 1 ? "s" : ""}`}
        </div>

        {!isLoading && filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 py-16 text-center">
            <div className="text-foreground font-medium">Aucun résultat</div>
            <div className="text-sm text-muted-foreground mt-1">
              Essayez d'autres mots-clés ou ajoutez un produit depuis l'administration.
            </div>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}