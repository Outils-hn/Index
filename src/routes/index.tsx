import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  X,
  SlidersHorizontal,
  LogIn,
  Eye,
  Star,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Dices,
} from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProductCard } from "@/components/ProductCard";
import { fetchCategories } from "@/lib/taxonomies";
import { getCategoryIcon } from "@/lib/category-icons";
import { LayoutGrid } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { fetchProductsWithAuthors } from "@/lib/products";
import { CompareProvider } from "@/components/CompareContext";
import { CompareBar } from "@/components/CompareBar";
import { useFavorites } from "@/hooks/use-favorites";

type StatTone = "neutral" | "green" | "orange" | "terracotta";

const STAT_TONES: Record<StatTone, string> = {
  neutral: "text-foreground/70 bg-secondary/60 border-border",
  green:
    "text-[oklch(0.4_0.13_150)] bg-[oklch(0.96_0.05_150)] border-[oklch(0.85_0.1_150)] dark:bg-[oklch(0.28_0.06_150)] dark:text-[oklch(0.82_0.14_150)] dark:border-[oklch(0.45_0.1_150)]/40",
  orange:
    "text-[oklch(0.45_0.15_60)] bg-[oklch(0.96_0.07_70)] border-[oklch(0.85_0.12_70)] dark:bg-[oklch(0.3_0.08_60)] dark:text-[oklch(0.82_0.15_70)] dark:border-[oklch(0.5_0.12_70)]/40",
  terracotta:
    "text-[oklch(0.5_0.16_40)] bg-[oklch(0.96_0.06_45)] border-[oklch(0.82_0.12_45)] dark:bg-[oklch(0.3_0.09_40)] dark:text-[oklch(0.82_0.16_45)] dark:border-[oklch(0.5_0.14_45)]/40",
};

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: StatTone;
}) {
  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2.5 ${STAT_TONES[tone]}`}>
      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background/60 border border-current/10">
        {icon}
      </span>
      <div className="min-w-0">
        <div className="text-lg font-bold leading-tight tabular-nums">{value}</div>
        <div className="text-[11px] uppercase tracking-wider opacity-80 truncate">{label}</div>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Index ·" },
      { name: "description", content: "INDEX — bibliothèque technique pour bureau d'études façade." },
      { property: "og:title", content: "INDEX — Fiches techniques" },
      { property: "og:description", content: "Bibliothèque produits pour bureau d'études façade architecturale." },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <CompareProvider>
      <IndexInner />
      <CompareBar />
    </CompareProvider>
  );
}

function IndexInner() {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [randomId, setRandomId] = useState<string | null>(null);
  const [rolling, setRolling] = useState(false);
  const { user } = useAuth();
  const { isFavorite, favorites } = useFavorites();

  const { data: products = [], isLoading } = useQuery({
    queryKey: ["products"],
    queryFn: fetchProductsWithAuthors,
  });
  const { data: categories = [] } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const stats = useMemo(() => {
    let upToDate = 0;
    let toCheck = 0;
    const now = Date.now();
    for (const p of products) {
      const months = (now - new Date(p.updated_at).getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
      if (months < 12) upToDate++;
      else toCheck++;
    }
    const favCount = products.filter((p) => favorites.has(p.id)).length;
    return { total: products.length, upToDate, toCheck, favCount };
  }, [products, favorites]);

  const filtered = useMemo(() => {
    if (randomId) {
      const found = products.find((p) => p.id === randomId);
      return found ? [found] : [];
    }
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (favoritesOnly && !isFavorite(p.id)) return false;
      if (category && p.category !== category) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.supplier.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)) ||
        (p.projects ?? []).some((pr) => pr.nom.toLowerCase().includes(q) || pr.numero.toLowerCase().includes(q))
      );
    });
  }, [products, search, category, favoritesOnly, isFavorite, randomId]);

  const rollRandom = () => {
    if (products.length === 0 || rolling) return;
    setRolling(true);
    window.setTimeout(() => {
      const pick = products[Math.floor(Math.random() * products.length)];
      setRandomId(pick.id);
      setRolling(false);
    }, 420);
  };

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="px-4 md:px-8 lg:px-10 py-4 md:py-10">
        <div className="mb-5 md:mb-8">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <h1 className="font-display text-xl md:text-3xl font-bold tracking-[0.12em] uppercase text-foreground">
                Bibliothèque technique
              </h1>
              <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-1.5">
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

        {!isLoading && products.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-5">
            <StatCard icon={<FileText className="h-4 w-4" />} label="Total fiches" value={stats.total} tone="neutral" />
            <StatCard icon={<CheckCircle2 className="h-4 w-4" />} label="À jour" value={stats.upToDate} tone="green" />
            <StatCard
              icon={<AlertTriangle className="h-4 w-4" />}
              label="À vérifier"
              value={stats.toCheck}
              tone="orange"
            />
            <StatCard
              icon={<Star className="h-4 w-4" fill="currentColor" />}
              label="Favoris"
              value={stats.favCount}
              tone="terracotta"
            />
          </div>
        )}

        <div className="flex items-stretch gap-2 mb-5">
          <div className="relative flex-1">
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
          <button
            type="button"
            onClick={rollRandom}
            disabled={products.length === 0 || rolling}
            aria-label="Fiche au hasard"
            title="Fiche au hasard"
            className="group shrink-0 h-12 w-12 inline-flex items-center justify-center rounded-md border border-border bg-card text-foreground/80 hover:text-white hover:bg-[oklch(0.62_0.16_40)] hover:border-[oklch(0.62_0.16_40)] transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          >
            <Dices
              className={`h-5 w-5 transition-transform duration-300 group-hover:rotate-12 ${
                rolling ? "animate-spin" : ""
              }`}
            />
          </button>
        </div>

        {randomId && (
          <div className="mb-4 flex items-center justify-between gap-2 rounded-md border border-[oklch(0.7_0.14_45)]/40 bg-[oklch(0.96_0.06_45)] dark:bg-[oklch(0.3_0.09_40)] px-3 py-2 text-xs text-[oklch(0.45_0.18_40)] dark:text-[oklch(0.82_0.16_45)]">
            <span className="inline-flex items-center gap-2">
              <Dices className="h-3.5 w-3.5" />
              Tirage au sort — une fiche sélectionnée aléatoirement.
            </span>
            <button
              type="button"
              onClick={() => setRandomId(null)}
              className="inline-flex items-center gap-1 font-medium hover:underline"
            >
              <X className="h-3 w-3" /> Voir toutes les fiches
            </button>
          </div>
        )}

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
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground/70 mt-3 mb-6">
          <span className="uppercase tracking-wider text-[10px] font-medium text-muted-foreground/50">Validité :</span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[oklch(0.6_0.18_150)] shadow-[0_0_4px_oklch(0.65_0.2_150)]" />
            À jour (&lt;1 an)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[oklch(0.7_0.17_70)] shadow-[0_0_4px_oklch(0.75_0.18_70)]" />
            À vérifier (1-2 ans)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[oklch(0.6_0.2_28)] shadow-[0_0_4px_oklch(0.65_0.22_28)]" />
            Possiblement obsolète (&gt;2 ans)
          </span>
        </div>
        <div className="text-sm text-muted-foreground mb-4">
          {isLoading ? "Chargement…" : `${filtered.length} produit${filtered.length > 1 ? "s" : ""}`}
        </div>

        {!isLoading && filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-card/50 py-16 text-center">
            {favoritesOnly ? (
              <div className="text-sm text-muted-foreground">Aucun produit dans vos favoris pour le moment.</div>
            ) : (
              <>
                <div className="text-foreground font-medium">Aucun résultat</div>
                <div className="text-sm text-muted-foreground mt-1">
                  Essayez d'autres mots-clés ou ajoutez un produit depuis l'administration.
                </div>
              </>
            )}
          </div>
        ) : (
          <div
            className={`grid gap-4 auto-rows-fr sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 transition-all duration-300 ${
              rolling ? "blur-sm opacity-60 scale-[0.99]" : "blur-0 opacity-100 scale-100"
            }`}
          >
            {filtered.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
