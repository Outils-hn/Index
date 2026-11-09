import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { lazy, Suspense, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { couleurFamille } from "@/lib/famille-couleur";
import { useQuery } from "@tanstack/react-query";
import { Search, X, Star, Plus, Trash2 } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { ProductCard, fmtDate, type Product } from "@/components/ProductCard";
import { supabase } from "@/integrations/supabase/client";
import { fetchCategories } from "@/lib/taxonomies";
import { useAuth, useApproval } from "@/hooks/use-auth";
import { useProducts } from "@/lib/products";
import { CompareProvider } from "@/components/CompareContext";
import { CompareBar } from "@/components/CompareBar";
import { useFavorites } from "@/hooks/use-favorites";
import { FichesARelire } from "@/components/famille/FichesARelire";
import { trouverFournisseurAccess, useFournisseursAccess } from "@/lib/access";
import { checkedAt, haystack, matches, num, validity } from "@/lib/search";
import { DOSE_DU_MOIS, aRelire, verifieesCeMois } from "@/lib/verification";
import { useCorbeille } from "@/lib/corbeille";
import { ask } from "@/lib/confirm";

// Fenetres d'ajout, de modification et de corbeille, chargees a la premiere ouverture
const AjouterFicheDialog = lazy(() => import("@/components/AjouterFicheDialog").then((m) => ({ default: m.AjouterFicheDialog })));
const CorbeilleDialog = lazy(() => import("@/components/CorbeilleDialog").then((m) => ({ default: m.CorbeilleDialog })));
const EditProductDialog = lazy(() => import("@/components/EditProductDialog").then((m) => ({ default: m.EditProductDialog })));

// Lecteur PDF charge a la premiere ouverture seulement
const PdfViewerModal = lazy(() => import("@/components/PdfViewerModal").then((m) => ({ default: m.PdfViewerModal })));

type Tri = "defaut" | "anciens" | "recents" | "nom" | "fournisseur" | "famille";
const TRIS: { value: Tri; label: string }[] = [
  { value: "famille", label: "Par famille" },
  { value: "fournisseur", label: "Par fournisseur" },
  { value: "defaut", label: "Dernières modifiées" },
  { value: "anciens", label: "Vérifiées il y a le plus longtemps" },
  { value: "recents", label: "Vérifiées le plus récemment" },
  { value: "nom", label: "Nom (A → Z)" },
];
const cleRappel = () => `index:rappel:${new Date().toISOString().slice(0, 7)}`;

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
  // ?q=<texte> : recherche pre-remplie (ex. Access ouvre les fiches d'un fournisseur)
  validateSearch: (s: Record<string, unknown>): { fiche?: string; q?: string } => ({
    ...(typeof s.fiche === "string" && s.fiche ? { fiche: s.fiche } : {}),
    ...(typeof s.q === "string" && s.q.trim() ? { q: s.q.trim().slice(0, 100) } : {}),
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

type Filtre = { kind: "all" } | { kind: "fav" } | { kind: "check" } | { kind: "cat"; name: string };

const CHIP = "inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-2.5 text-xs transition-colors sm:py-1";
const CHIP_ON = `${CHIP} border-[var(--app-fill)] bg-[var(--app-fill)] text-[var(--app-on)]`;
const CHIP_OFF = `${CHIP} border-border text-muted-foreground hover:text-foreground`;

function IndexInner() {
  const [search, setSearch] = useState("");
  const [filtre, setFiltre] = useState<Filtre>({ kind: "all" });
  const [tri, setTri] = useState<Tri>("famille");
  const [pdfId, setPdfId] = useState<string | null>(null);
  const [aModifier, setAModifier] = useState<Product | null>(null);
  const [relireOuvert, setRelireOuvert] = useState(false);
  const [ajoutOuvert, setAjoutOuvert] = useState(false);
  const [corbeilleOuverte, setCorbeilleOuverte] = useState(false);
  const [rappelMasque, setRappelMasque] = useState(() => {
    try { return localStorage.getItem(cleRappel()) === "1"; } catch { return false; }
  });
  const { user } = useAuth();
  const { approved } = useApproval(user);
  const { favorites, toggle: toggleFavorite } = useFavorites();
  const { products: all, isLoading, error, offlineSince, refetch } = useProducts();
  const { data: categories = [] } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories, retry: 0 });
  const searchRef = useRef<HTMLInputElement>(null);
  // Recherche differee : la saisie reste fluide meme avec des centaines de fiches
  const q = useDeferredValue(search);
  const { fiche, q: qLien } = Route.useSearch();
  // Recherche venue d'un lien : recopiee une fois dans la barre de recherche, modifiable ensuite
  useEffect(() => { if (qLien) setSearch(qLien); }, [qLien]);
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
        .map(({ p }) => p)
        .sort(
          tri === "anciens" ? (a, b) => checkedAt(a).localeCompare(checkedAt(b))
          : tri === "recents" ? (a, b) => checkedAt(b).localeCompare(checkedAt(a))
          : tri === "nom" ? (a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base", numeric: true })
          : tri === "famille" ? (a, b) => a.category.localeCompare(b.category, "fr", { sensitivity: "base" }) || a.name.localeCompare(b.name, "fr", { sensitivity: "base", numeric: true })
          : tri === "fournisseur" ? (a, b) => (a.supplier || "\uffff").localeCompare(b.supplier || "\uffff", "fr", { sensitivity: "base" }) || a.name.localeCompare(b.name, "fr", { sensitivity: "base", numeric: true })
          : () => 0, // « Dernières modifiées » : ordre d'arrivee de la base
        ),
    [products, q, filtre, favorites, fiche, ficheLiee, tri],
  );

  // Lien « fournisseur » vers Access : une correspondance par nom de fournisseur (calculee une fois)
  const fournisseursAccess = useFournisseursAccess();
  const accessParFournisseur = useMemo(() => {
    const m = new Map<string, string>();
    for (const { p } of products) {
      if (!p.supplier || m.has(p.supplier)) continue;
      const f = trouverFournisseurAccess(p.supplier, fournisseursAccess);
      if (f) m.set(p.supplier, f.id);
    }
    return m;
  }, [products, fournisseursAccess]);

  // Lecteur PDF de la page : fiche precedente / suivante parmi les fiches affichees qui ont un PDF
  const avecPdf = useMemo(() => filtered.filter((p) => !!p.pdf_path), [filtered]);
  const ouvrirPdf = useCallback((p: Product) => setPdfId(p.id), []);
  const modifier = useCallback((p: Product) => setAModifier(p), []);
  const { trash } = useCorbeille();
  const supprimer = useCallback(async (p: Product) => {
    if (await ask({ title: `Mettre « ${p.name} » à la corbeille ?`, message: "Vous pourrez la restaurer pendant 30 jours, PDF compris.", confirm: "Mettre à la corbeille", danger: true })) {
      trash.mutate({ id: p.id });
    }
  }, [trash]);
  const dansCorbeille = useMemo(() => all.filter((p) => p.deleted_at), [all]);
  const posPdf = pdfId ? avecPdf.findIndex((p) => p.id === pdfId) : -1;
  const ficheOuverte = posPdf >= 0 ? avecPdf[posPdf] : null;

  // Rappel mensuel : tant que la dose du mois n'est pas faite et qu'il reste des fiches a relire
  const nbARelire = useMemo(() => aRelire(all).length, [all]);
  const faitesCeMois = useMemo(() => verifieesCeMois(all), [all]);
  const rappel = approved && !isLoading && !error && !fiche && !rappelMasque && nbARelire > 0 && faitesCeMois < DOSE_DU_MOIS;
  const masquerRappel = () => {
    setRappelMasque(true);
    try { localStorage.setItem(cleRappel(), "1"); } catch { /* sans stockage : masque jusqu'au prochain chargement */ }
  };

  // Affichage par paquets de 60 : au-dela, « Afficher plus » (la recherche reste instantanee)
  const [limit, setLimit] = useState(60);
  useEffect(() => setLimit(60), [q, filtre, tri]);
  const shown = filtered.slice(0, limit);
  // « Par fournisseur » / « Par famille » : une section par groupe (deja trie), « Sans … » a la fin
  const groupes = useMemo(() => {
    if (tri !== "fournisseur" && tri !== "famille") return [];
    const m = new Map<string, Product[]>();
    for (const p of shown) {
      const k = (tri === "famille" ? p.category : p.supplier)?.trim() || (tri === "famille" ? "Sans famille" : "Sans fournisseur");
      m.set(k, [...(m.get(k) ?? []), p]);
    }
    return [...m].map(([nom, fiches]) => ({ nom, fiches }));
  }, [shown, tri]);

  const is = (f: Filtre) => filtre.kind === f.kind && (f.kind !== "cat" || (filtre.kind === "cat" && filtre.name === f.name));

  return (
    <div className="min-h-screen bg-background">
      <a href="#recherche" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md"
        onClick={(e) => { e.preventDefault(); searchRef.current?.focus(); }}>Aller à la recherche</a>
      <AppHeader />
      {offlineSince && (
        <div role="status" className="border-b border-border bg-muted px-4 py-2 text-center text-xs text-foreground">
          Base de données injoignable : copie locale du {fmtDate(offlineSince)}, en lecture seule. Les PDF ne s'ouvriront peut-être pas.
        </div>
      )}
      <main className="page py-8">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">Fiches techniques</h1>
            {!isLoading && !error && (
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="num">{num(products.length)}</span> fiches
                {toCheck > 0 && (
                  <>
                    {" · "}
                    <button type="button" onClick={() => setFiltre({ kind: "check" })} className="inline-flex min-h-10 items-center gap-1 text-warn underline-offset-2 hover:underline sm:min-h-0">
                      <span className="num">{num(toCheck)}</span> à vérifier
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {approved && !isLoading && !error && <FichesARelire products={all} open={relireOuvert} onOpenChange={setRelireOuvert} />}
            {approved && !isLoading && !error && !offlineSince && (
              <>
                {dansCorbeille.length > 0 && (
                  <button type="button" onClick={() => setCorbeilleOuverte(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-md border border-border px-3 text-xs text-muted-foreground hover:text-foreground sm:min-h-9">
                    <Trash2 className="h-3.5 w-3.5" aria-hidden="true" /> Corbeille <span className="num opacity-70">{dansCorbeille.length}</span>
                  </button>
                )}
                <button type="button" onClick={() => setAjoutOuvert(true)} className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground hover:opacity-90 sm:min-h-9">
                  <Plus className="h-4 w-4" aria-hidden="true" /> Ajouter une fiche
                </button>
              </>
            )}
          </div>
          {!user && (
            <p className="text-xs text-muted-foreground">
              <Link to="/auth" className="inline-flex min-h-10 items-center text-foreground underline underline-offset-2 sm:min-h-0">Se connecter</Link>{" "}
              pour ajouter des fiches
            </p>
          )}
        </div>

        {rappel && (
          <div role="status" className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-lg border border-border bg-card px-4 py-3 text-sm">
            <p className="min-w-0 flex-1 text-foreground">
              <span className="num">{num(Math.min(nbARelire, DOSE_DU_MOIS - faitesCeMois))}</span> fiche{Math.min(nbARelire, DOSE_DU_MOIS - faitesCeMois) > 1 ? "s" : ""} à relire ce mois-ci
              <span className="text-muted-foreground"> · fait : <span className="num">{faitesCeMois}</span>/{DOSE_DU_MOIS}</span>
            </p>
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setRelireOuvert(true)} className="inline-flex min-h-10 items-center rounded-md bg-primary px-3 text-xs font-medium text-primary-foreground hover:opacity-90 sm:min-h-8">Relire maintenant</button>
              <button type="button" onClick={masquerRappel} className="inline-flex min-h-10 items-center rounded-md border border-border px-3 text-xs text-muted-foreground hover:text-foreground sm:min-h-8">Plus tard</button>
            </div>
          </div>
        )}

        <div className="relative mb-4">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <input
            id="recherche"
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
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <ProductCard product={ficheLiee} accessId={accessParFournisseur.get(ficheLiee.supplier) ?? null} onEdit={approved && !offlineSince ? modifier : undefined} onDelete={approved && !offlineSince ? supprimer : undefined} loggedIn={approved} favorite={favorites.has(ficheLiee.id)} onToggleFavorite={toggleFavorite} autoOpen />
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
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                <span className="num">{num(filtered.length)}</span> fiche{filtered.length > 1 ? "s" : ""}
              </p>
              <label className="flex items-center gap-2 text-xs text-muted-foreground">
                Trier
                <select
                  value={tri}
                  onChange={(e) => setTri(e.target.value as Tri)}
                  className="h-10 rounded-md border border-input bg-card px-2 text-xs text-foreground outline-none focus:border-foreground sm:h-8"
                >
                  {TRIS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </label>
            </div>
            {tri === "fournisseur" || tri === "famille" ? (
              <div className="flex flex-col gap-8">
                {groupes.map((g) => (
                  <section key={g.nom} aria-label={g.nom}>
                    {!(tri === "famille" && groupes.length === 1) && (
                    <div className="mb-3 flex items-center gap-3">
                      <h2 className={`${tri === "famille" ? "famille" : "text-foreground"} text-sm font-bold uppercase tracking-[0.06em]`} style={tri === "famille" ? ({ "--fam-l": couleurFamille(g.nom).clair, "--fam-d": couleurFamille(g.nom).sombre } as CSSProperties) : undefined}>{g.nom}</h2>
                      <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs text-muted-foreground"><span className="num">{g.fiches.length}</span> fiche{g.fiches.length > 1 ? "s" : ""}</span>
                      <div className="h-px flex-1 bg-border" aria-hidden="true" />
                    </div>
                    )}
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {g.fiches.map((p) => (
                        <ProductCard key={p.id} colorerFamille={filtre.kind !== "cat" && tri !== "famille"} masquerFamille={filtre.kind === "cat" || tri === "famille"} product={p} loggedIn={approved} favorite={favorites.has(p.id)} onToggleFavorite={toggleFavorite} onOpenPdf={ouvrirPdf} accessId={accessParFournisseur.get(p.supplier) ?? null} onEdit={approved && !offlineSince ? modifier : undefined} onDelete={approved && !offlineSince ? supprimer : undefined} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {shown.map((p) => (
                  <ProductCard key={p.id} colorerFamille={filtre.kind !== "cat"} masquerFamille={filtre.kind === "cat"} product={p} loggedIn={approved} favorite={favorites.has(p.id)} onToggleFavorite={toggleFavorite} onOpenPdf={ouvrirPdf} accessId={accessParFournisseur.get(p.supplier) ?? null} onEdit={approved && !offlineSince ? modifier : undefined} onDelete={approved && !offlineSince ? supprimer : undefined} />
                ))}
              </div>
            )}
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
      {ajoutOuvert && (
        <Suspense fallback={null}>
          <AjouterFicheDialog open onOpenChange={(o) => { if (!o) setAjoutOuvert(false); }} />
        </Suspense>
      )}
      {corbeilleOuverte && (
        <Suspense fallback={null}>
          <CorbeilleDialog fiches={dansCorbeille} open onOpenChange={(o) => { if (!o) setCorbeilleOuverte(false); }} />
        </Suspense>
      )}
      {aModifier && (
        <Suspense fallback={null}>
          <EditProductDialog product={aModifier} open onOpenChange={(o) => { if (!o) setAModifier(null); }} />
        </Suspense>
      )}
      {ficheOuverte && (
        <Suspense fallback={null}>
          <PdfViewerModal
            open
            onClose={() => setPdfId(null)}
            productName={ficheOuverte.name}
            pdfUrl={supabase.storage.from("technical-sheets").getPublicUrl(ficheOuverte.pdf_path!).data.publicUrl}
            pdfFilename={ficheOuverte.pdf_filename}
            position={avecPdf.length > 1 ? `${posPdf + 1} / ${avecPdf.length}` : undefined}
            onPrev={posPdf > 0 ? () => setPdfId(avecPdf[posPdf - 1].id) : undefined}
            onNext={posPdf < avecPdf.length - 1 ? () => setPdfId(avecPdf[posPdf + 1].id) : undefined}
            onEdit={approved && !offlineSince ? () => modifier(ficheOuverte) : undefined}
          />
        </Suspense>
      )}
    </div>
  );
}
