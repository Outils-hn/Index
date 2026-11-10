import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, Check, X, Tags, Building2, MapPin, Search } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { ask } from "@/lib/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { QuickAddDialog } from "@/components/QuickAddDialog";
import { CategoryIconPicker } from "@/components/CategoryIconPicker";
import { supabase } from "@/integrations/supabase/client";
import { fetchProjects, createProject, updateProject, deleteProject, type Project } from "@/lib/projects";
import { useAuth, useApproval } from "@/hooks/use-auth";
import { CompteEnAttente } from "@/components/famille/CompteEnAttente";
import {
  fetchCategories, fetchSuppliers, createCategory, createSupplier, renameCategory, renameSupplier,
  deleteCategory, deleteSupplier, updateCategoryIcon, type Taxonomy,
} from "@/lib/taxonomies";

export const Route = createFileRoute("/config")({
  head: () => ({
    meta: [
      { title: "Listes — Index" },
      { name: "description", content: "Gérer les catégories et fournisseurs." },
    ],
  }),
  component: ConfigPage,
});

/** Nombre de fiches (hors corbeille) qui utilisent chaque categorie, fournisseur ou chantier. */
function useUsage() {
  return useQuery({
    queryKey: ["usage-listes"],
    queryFn: async () => {
      const [p, pp] = await Promise.all([
        supabase.from("products").select("id,category,supplier,deleted_at"),
        supabase.from("product_projects").select("product_id,project_id"),
      ]);
      if (p.error) throw p.error;
      const vivantes = new Map<string, { category: string; supplier: string }>();
      for (const r of (p.data ?? []) as Array<{ id: string; category: string; supplier: string; deleted_at: string | null }>) if (!r.deleted_at) vivantes.set(r.id, r);
      const categories: Record<string, number> = {}, suppliers: Record<string, number> = {}, projects: Record<string, number> = {};
      for (const r of vivantes.values()) {
        categories[r.category] = (categories[r.category] ?? 0) + 1;
        suppliers[r.supplier] = (suppliers[r.supplier] ?? 0) + 1;
      }
      for (const r of (pp.data ?? []) as Array<{ product_id: string; project_id: string }>) if (vivantes.has(r.product_id)) projects[r.project_id] = (projects[r.project_id] ?? 0) + 1;
      return { categories, suppliers, projects };
    },
  });
}

const fiches = (n: number) => `${n} fiche${n > 1 ? "s" : ""}`;

function ConfigPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { approved, checking } = useApproval(user);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  if (authLoading || checking) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="page py-16 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement de la session…
        </main>
      </div>
    );
  }

  if (!user) return null;
  if (!approved) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <CompteEnAttente email={user.email} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="page py-10">
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.08em] text-[var(--app-ink)] mb-1">Listes</div>
          <h1 className="text-2xl font-bold tracking-tight">Catégories, fournisseurs et chantiers</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">Gérez les listes utilisées dans toute l'application.</p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-8">
            <CategoriesPanel />
            <ProjectsPanel />
          </div>
          <SuppliersPanel />
        </div>

        <p className="mt-8 rounded-lg border border-border bg-card px-5 py-4 text-sm text-muted-foreground">
          Les comptes, l'historique des modifications et les statistiques sont maintenant dans le{" "}
          <a className="font-medium text-foreground underline underline-offset-2" href="https://outils-hn.github.io/#tableau">
            Tableau de bord de l'Accueil
          </a>
          .
        </p>
      </main>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Briques communes : cadre de liste (recherche + defilement) et ligne editable */
/* -------------------------------------------------------------------------- */

const SEUIL_RECHERCHE = 8;

function Cadre<T extends { id: string }>({ titre, icone, items, loading, vide, onAjouter, texte, ligne, label }: {
  titre: string; icone: React.ReactNode; items: T[]; loading: boolean; vide: string; onAjouter: () => void;
  texte: (it: T) => string; ligne: (it: T) => React.ReactNode; label: string;
}) {
  const [q, setQ] = useState("");
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return t ? items.filter((i) => texte(i).toLowerCase().includes(t)) : items;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, q]);
  return (
    <section>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <h2 className="flex items-center gap-2 font-semibold">
            {icone}
            {titre}
            <span className="text-muted-foreground font-normal text-sm">({items.length})</span>
          </h2>
          <Button size="sm" onClick={onAjouter}>
            <Plus className="h-4 w-4 mr-1.5" />
            Ajouter
          </Button>
        </div>
        {items.length > SEUIL_RECHERCHE && (
          <div className="relative border-b border-border px-5 py-2.5">
            <Search className="pointer-events-none absolute left-8 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Escape" && setQ("")} placeholder="Filtrer…" aria-label={label} className="h-9 pl-9" />
          </div>
        )}
        {loading ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">{vide}</div>
        ) : visibles.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-muted-foreground">Aucun résultat pour « {q} ».</div>
        ) : (
          <ul className="max-h-[26rem] divide-y divide-border overflow-y-auto">{visibles.map((it) => <li key={it.id}>{ligne(it)}</li>)}</ul>
        )}
      </div>
    </section>
  );
}

/** Ligne : affichage normal, ou champs de saisie quand on clique sur le crayon. */
function Ligne({ avant, affichage, usage, champs, enregistrer, enCours, supprimer, nomAccessible }: {
  avant?: React.ReactNode; affichage: React.ReactNode; usage?: number;
  champs: { valeur: string; placeholder?: string; className?: string; max?: number }[];
  enregistrer: (valeurs: string[]) => void; enCours: boolean; supprimer: () => void; nomAccessible: string;
}) {
  const [edition, setEdition] = useState(false);
  const [vals, setVals] = useState<string[]>([]);
  const ouvrir = () => { setVals(champs.map((c) => c.valeur)); setEdition(true); };
  const valider = () => {
    if (vals.some((v) => !v.trim())) { toast.error(champs.length > 1 ? "Numéro et nom requis." : "Le nom est requis."); return; }
    enregistrer(vals);
    setEdition(false);
  };
  if (edition) {
    return (
      <div className="flex items-center gap-2 px-5 py-3">
        {avant}
        {champs.map((c, i) => (
          <Input key={i} autoFocus={i === champs.length - 1} value={vals[i] ?? ""} maxLength={c.max} placeholder={c.placeholder}
            onChange={(e) => setVals((v) => v.map((x, j) => (j === i ? e.target.value : x)))}
            onKeyDown={(e) => { if (e.key === "Enter") valider(); if (e.key === "Escape") setEdition(false); }}
            className={c.className ?? "flex-1 h-9"} aria-label={c.placeholder ?? "Nom"} />
        ))}
        <Button size="icon" variant="ghost" onClick={valider} disabled={enCours} aria-label="Valider">
          {enCours ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setEdition(false)} aria-label="Annuler"><X className="h-4 w-4" /></Button>
      </div>
    );
  }
  return (
    <div className="group flex items-center gap-2 px-5 py-2.5 hover:bg-secondary/40">
      {avant}
      <span className="flex min-w-0 flex-1 items-center gap-2 truncate">{affichage}</span>
      {usage !== undefined && (
        <span className={usage ? "shrink-0 text-xs tabular-nums text-muted-foreground" : "shrink-0 text-xs text-muted-foreground"}>{usage ? fiches(usage) : "inutilisé"}</span>
      )}
      <Button size="icon" variant="ghost" onClick={ouvrir} aria-label={`Renommer ${nomAccessible}`} className="text-muted-foreground hover:text-foreground"><Pencil className="h-4 w-4" /></Button>
      <Button size="icon" variant="ghost" onClick={supprimer} aria-label={`Supprimer ${nomAccessible}`} className="ml-1 text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" /></Button>
    </div>
  );
}

const messageSuppression = (n: number, suite: string) => (n ? `${fiches(n)} ${n > 1 ? "utilisent" : "utilise"} cette valeur. ${suite}` : "Aucune fiche n'utilise cette valeur.");

/* -------------------------------------------------------------------------- */
/* Fournisseurs                                                               */
/* -------------------------------------------------------------------------- */

function SuppliersPanel() {
  const qc = useQueryClient();
  const [ajout, setAjout] = useState(false);
  const { data: items = [], isLoading } = useQuery({ queryKey: ["suppliers"], queryFn: fetchSuppliers });
  const { data: usage } = useUsage();
  const renommer = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameSupplier(id, name),
    onSuccess: () => { toast.success("Renommé."); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const supprimer = useMutation({
    mutationFn: (id: string) => deleteSupplier(id),
    onSuccess: () => { toast.success("Supprimé."); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <Cadre titre="Fournisseurs" icone={<Building2 className="h-4 w-4" />} items={items} loading={isLoading} vide="Aucune entrée pour le moment."
        onAjouter={() => setAjout(true)} texte={(i) => i.name} label="Filtrer les fournisseurs"
        ligne={(it) => (
          <Ligne affichage={it.name} usage={usage ? usage.suppliers[it.name] ?? 0 : undefined} nomAccessible={it.name}
            champs={[{ valeur: it.name, max: 80 }]} enCours={renommer.isPending}
            enregistrer={([name]) => renommer.mutate({ id: it.id, name })}
            supprimer={async () => {
              const n = usage?.suppliers[it.name] ?? 0;
              if (await ask({ title: `Supprimer « ${it.name} » ?`, message: messageSuppression(n, "Elles la conserveront comme texte."), confirm: "Supprimer", danger: true })) supprimer.mutate(it.id);
            }} />
        )} />
      <QuickAddDialog open={ajout} onOpenChange={setAjout} title="Ajouter un fournisseur" label="Nom" placeholder="Ex. Sika"
        onSubmit={async (n) => { const c = await createSupplier(n); qc.invalidateQueries({ queryKey: ["suppliers"] }); return c; }} />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Categories (avec choix d'icone)                                            */
/* -------------------------------------------------------------------------- */

function CategoriesPanel() {
  const qc = useQueryClient();
  const [ajout, setAjout] = useState(false);
  const { data: items = [], isLoading } = useQuery({ queryKey: ["categories"], queryFn: fetchCategories });
  const { data: usage } = useUsage();
  const renommer = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameCategory(id, name),
    onSuccess: () => { toast.success("Renommé."); qc.invalidateQueries({ queryKey: ["categories"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const icone = useMutation({
    mutationFn: ({ id, icon }: { id: string; icon: string | null }) => updateCategoryIcon(id, icon),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
    onError: (e: Error) => toast.error(e.message),
  });
  const supprimer = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => { toast.success("Supprimé."); qc.invalidateQueries({ queryKey: ["categories"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <Cadre titre="Catégories" icone={<Tags className="h-4 w-4" />} items={items} loading={isLoading} vide="Aucune catégorie pour le moment."
        onAjouter={() => setAjout(true)} texte={(i) => i.name} label="Filtrer les catégories"
        ligne={(it: Taxonomy) => (
          <Ligne avant={<CategoryIconPicker value={it.icon ?? null} name={it.name} size="sm" onChange={(key) => icone.mutate({ id: it.id, icon: key })} />}
            affichage={it.name} usage={usage ? usage.categories[it.name] ?? 0 : undefined} nomAccessible={it.name}
            champs={[{ valeur: it.name, max: 80 }]} enCours={renommer.isPending}
            enregistrer={([name]) => renommer.mutate({ id: it.id, name })}
            supprimer={async () => {
              const n = usage?.categories[it.name] ?? 0;
              if (await ask({ title: `Supprimer « ${it.name} » ?`, message: messageSuppression(n, "Elles la conserveront comme texte."), confirm: "Supprimer", danger: true })) supprimer.mutate(it.id);
            }} />
        )} />
      <AddCategoryDialog open={ajout} onOpenChange={setAjout} onCreated={() => qc.invalidateQueries({ queryKey: ["categories"] })} />
    </>
  );
}

function AddCategoryDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setName("");
    setIcon(null);
    setLoading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    if (trimmed.length > 80) {
      toast.error("Le nom doit faire moins de 80 caractères.");
      return;
    }
    setLoading(true);
    try {
      await createCategory(trimmed, icon);
      toast.success("Catégorie ajoutée.");
      onCreated();
      reset();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'ajout.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Ajouter une catégorie</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-category-name">Nom</Label>
            <div className="flex items-center gap-2">
              <CategoryIconPicker value={icon} onChange={setIcon} name={name} />
              <Input
                id="new-category-name"
                autoFocus
                maxLength={80}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex. Isolants"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Choisissez une icône (facultatif) — une icône neutre sera utilisée par défaut.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !name.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
/* -------------------------------------------------------------------------- */
/* Projets / chantiers                                                        */
/* -------------------------------------------------------------------------- */

function ProjectsPanel() {
  const qc = useQueryClient();
  const [ajout, setAjout] = useState(false);
  const { data: items = [], isLoading } = useQuery({ queryKey: ["projects"], queryFn: fetchProjects });
  const { data: usage } = useUsage();
  const maj = useMutation({
    mutationFn: ({ id, numero, nom }: { id: string; numero: string; nom: string }) => updateProject(id, numero, nom),
    onSuccess: () => { toast.success("Projet mis à jour."); qc.invalidateQueries({ queryKey: ["projects"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const supprimer = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => { toast.success("Projet supprimé."); qc.invalidateQueries({ queryKey: ["projects"] }); qc.invalidateQueries({ queryKey: ["usage-listes"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  return (
    <>
      <Cadre titre="Projets / Chantiers" icone={<MapPin className="h-4 w-4" />} items={items} loading={isLoading} vide="Aucun projet pour le moment."
        onAjouter={() => setAjout(true)} texte={(i: Project) => `${i.numero} ${i.nom}`} label="Filtrer les chantiers"
        ligne={(it: Project) => (
          <Ligne avant={<MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
            affichage={<><span className="font-mono text-xs text-muted-foreground w-20 shrink-0">{it.numero}</span><span className="truncate">{it.nom}</span></>}
            usage={usage ? usage.projects[it.id] ?? 0 : undefined} nomAccessible={`${it.numero} ${it.nom}`}
            champs={[{ valeur: it.numero, placeholder: "Numéro", className: "h-9 w-28 font-mono" }, { valeur: it.nom, placeholder: "Nom", className: "flex-1 h-9" }]}
            enCours={maj.isPending} enregistrer={([numero, nom]) => maj.mutate({ id: it.id, numero, nom })}
            supprimer={async () => {
              const n = usage?.projects[it.id] ?? 0;
              if (await ask({ title: `Supprimer le chantier « ${it.numero} ${it.nom} » ?`, message: n ? `${fiches(n)} ${n > 1 ? "sont liées" : "est liée"} à ce chantier et ${n > 1 ? "perdront" : "perdra"} ce lien.` : "Aucune fiche n'est liée à ce chantier.", confirm: "Supprimer", danger: true })) supprimer.mutate(it.id);
            }} />
        )} />
      <AddProjectDialog open={ajout} onOpenChange={setAjout} onCreated={() => qc.invalidateQueries({ queryKey: ["projects"] })} />
    </>
  );
}

function AddProjectDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}) {
  const [numero, setNumero] = useState("");
  const [nom, setNom] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setNumero("");
    setNom("");
    setLoading(false);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!numero.trim() || !nom.trim()) {
      toast.error("Numéro et nom requis.");
      return;
    }
    setLoading(true);
    try {
      await createProject(numero, nom);
      toast.success("Projet ajouté.");
      onCreated();
      reset();
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erreur lors de l'ajout.";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset();
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nouveau projet / chantier</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="new-proj-num">Numéro de projet</Label>
            <Input
              id="new-proj-num"
              autoFocus
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex. 4144D"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-proj-nom">Nom du projet</Label>
            <Input
              id="new-proj-nom"
              value={nom}
              onChange={(e) => setNom(e.target.value)}
              placeholder="Ex. Onyx"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
