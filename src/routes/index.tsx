import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Star } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProductCard, fmtDate } from "@/components/ProductCard";
import { fetchCategories } from "@/lib/taxonomies";
import { useAuth, useApproval } from "@/hooks/use-auth";
import { useProducts } from "@/lib/products";
import { CompareProvider } from "@/components/CompareContext";
import { CompareBar } from "@/components/CompareBar";
import { useFavorites } from "@/hooks/use-favorites";
import { haystack, matches, num, validity } from "@/lib/search";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Bibliothèque — Index" },
      { name: "description", content: "Index — bibliothèque des fiches techniques du bureau d'études façade." },
      { property: "og:title", content: "Index — fiches techniques" },
      { property: "og:description", content: "Bibliothèque des fiches techniques du bureau d'études façade." },
    ],
  }),
  // ?fiche=<id> : lien venant d'une autre appli (Masse, Strate, Format, Linear) vers une fiche precise
  validateSearch: (s: Record<string, unknown>): { fiche?: string } => (typeof s.fiche === "string" && s.fiche ? { fiche: s.fiche } : {}),
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

type Filtre = { kind: "all" } | { kind: "fav" } | { kind: "check" } | { kind: "cat"; name: string };

const CHIP = "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors";
const CHIP_ON = `${CHIP} border-foreground bg-foreground text-background`;
const CHIP_OFF = `${CHIP} border-border text-muted-foreground hover:text-foreground`;

function IndexInner() {
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState<Filtre>({ kind: "all" });
  const { user } = useAuth();
  const { approved } = useApproval(user);
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const { products: all, isLoading, error, offlineSince, refetch } = useProducts();
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories, retry: 0 });
  const searchRef = useRef<HTMLInputElement>(null);
  // Recherche differee : la saisie reste fluide meme avec des centaines de fiches
  const q = useDeferredValue(search);
  const { fiche } = Route.useSearch();
  const navigate = useNavigate();

  // « / » place le curseur dans la recherche, comme sur la plupart des sites
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key === "/" && !/INPUT|TEXTAREA|SELECT/.test(t?.tagName ?? "") && !t?.isContentEditable) {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Fiches actives (hors corbeille) avec leur texte cherchable calcule une fois
  const products = useMemo(() => all.filter((p) => !p.deleted_at).map((p) => ({ p, hay: haystack(p) })), [all]);
  const toCheck = useMemo(() => products.filter(({ p }) => validity(p) !== "valid").length, [products]);
  const favCount = useMemo(() => products.filter(({ p }) => favorites.has(p.id)).length, [products, favorites]);

  const ficheLiee = useMemo(() => (fiche ? products.find(({ p }) => p.id === fiche)?.p ?? null : null), [fiche, products]);
  const filtered = useMemo(
    () =>
      fiche ? (ficheLiee ? [ficheLiee] : []) : products
        .filter(({ p, hay }) => {
          if (filtre.kind === "fav" && !favorites.has(p.id)) return false;
          if (filtre.kind === "check" && validity(p) === "valid") return false;
          if (filtre.kind === "cat" && p.category !== filtre.name) return false;
          return matches(p, q, hay);
        })
        .map(({ p }) => p),
    [products, q, filtre, favorites, fiche, ficheLiee],
  );

  // Affichage par paquets de 60 : au-dela, « Afficher plus » (la recherche reste instantanee)
  const [limit, setLimit] = useState(60);
  useEffect(() => setLimit(60), [q, filtre]);
  const shown = filtered.slice(0, limit);

  const is = (f: Filtre) => filtre.kind === f.kind && (f.kind !== "cat" || (filtre.kind === "cat" && filtre.name === f.name));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      {offlineSince && (
        <div role="status" className="border-b border-border bg-muted px-4 py-2 text-center text-xs text-foreground">
          Base de données injoignable : copie locale du {fmtDate(offlineSince)}, en lecture seule. Les PDF ne s'ouvriront peut-être pas.
        </div>
      )}
      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Fiches techniques</h1>
            {!isLoading && !error && (
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="num">{num(products.length)}</span> fiches
                {toCheck > 0 && (
                  <>
                    {" · "}
                    <button type="button" onClick={() => setFiltre({ kind: "check" })} className="text-warn underline-offset-2 hover:underline">
                      <span className="num">{num(toCheck)}</span> à vérifier
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
          {!user && (
            <p className="text-xs text-muted-foreground">
              Lecture seule ·{" "}
              <Link to="/auth" className="text-foreground underline-offset-2 hover:underline">Se connecter</Link>{" "}
              pour ajouter des fiches
            </p>
          )}
        </div>

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            ref={searchRef}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
            aria-label="Rechercher une fiche"
            placeholder="Rechercher : produit, fournisseur, catégorie, mot-clé, chantier…   ( / )"
            className="h-11 w-full rounded-lg border border-input bg-card pl-10 pr-10 text-[15px] text-foreground outline-none placeholder:text-muted-foreground focus:border-foreground"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label="Effacer la recherche">
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtres">
          <button type="button" className={is({ kind: "all" }) ? CHIP_ON : CHIP_OFF} aria-pressed={is({ kind: "all" })} onClick={() => setFiltre({ kind: "all" })}>Toutes</button>
          <button type="button" className={is({ kind: "fav" }) ? CHIP_ON : CHIP_OFF} aria-pressed={is({ kind: "fav" })} onClick={() => setFiltre(is({ kind: "fav" }) ? { kind: "all" } : { kind: "fav" })}>
            <Star className="h-3 w-3" fill={is({ kind: "fav" }) ? "currentColor" : "none"} aria-hidden="true" />
            Favoris <span className="num opacity-70">{favCount}</span>
          </button>
          <button type="button" className={is({ kind: "check" }) ? CHIP_ON : CHIP_OFF} aria-pressed={is({ kind: "check" })} onClick={() => setFiltre(is({ kind: "check" }) ? { kind: "all" } : { kind: "check" })}>
            À vérifier <span className="num opacity-70">{toCheck}</span>
          </button>
          <span className="mx-1 h-4 w-px bg-border" aria-hidden="true" />
          {categories.map((c) => {
            const f: Filtre = { kind: "cat", name: c.name };
            return (
              <button key={c.id} type="button" className={is(f) ? CHIP_ON : CHIP_OFF} aria-pressed={is(f)} onClick={() => setFiltre(is(f) ? { kind: "all" } : f)}>
                {c.name}
              </button>
            );
          })}
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Chargement…</p>
        ) : error ? (
          <div className="max-w-lg rounded-lg border border-border bg-card p-5" role="alert">
            <h2 className="text-base font-semibold">Base de données injoignable</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Vérifiez la connexion internet. Aucune copie locale n'est encore disponible sur cet ordinateur : elle sera créée à la prochaine ouverture réussie.
            </p>
            <button className="mt-4 rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted" onClick={() => refetch()}>Réessayer</button>
          </div>
        ) : fiche ? (
          <div className="space-y-3">
            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
              {ficheLiee ? "Fiche ouverte depuis une autre appli." : "Cette fiche n'existe plus dans Index (supprimée ou mise à la corbeille)."}
              <button type="button" onClick={() => navigate({ to: "/", search: {} })} className="text-foreground underline-offset-2 hover:underline">
                Voir toutes les fiches
              </button>
            </p>
            {ficheLiee && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <ProductCard product={ficheLiee} loggedIn={approved} favorite={favorites.has(ficheLiee.id)} onToggleFavorite={toggleFavorite} autoOpen />
              </div>
            )}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border py-14 text-center">
            <p className="font-medium text-foreground">Aucune fiche trouvée</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {filtre.kind === "fav" && !favCount ? "Ajoutez des favoris avec l'étoile d'une fiche." : "Essayez un autre mot, ou retirez le filtre."}
            </p>
          </div>
        ) : (
          <>
            <p className="mb-3 text-xs text-muted-foreground" aria-live="polite">
              <span className="num">{num(filtered.length)}</span> fiche{filtered.length > 1 ? "s" : ""}
            </p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((p) => (
                <ProductCard key={p.id} product={p} loggedIn={approved} favorite={favorites.has(p.id)} onToggleFavorite={toggleFavorite} />
              ))}
            </div>
            {filtered.length > shown.length && (
              <div className="mt-6 text-center">
                <button type="button" onClick={() => setLimit((l) => l + 60)} className="rounded-md border border-border px-4 py-2 text-sm hover:bg-muted">
                  Afficher plus ({num(filtered.length - shown.length)} restantes)
                </button>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
