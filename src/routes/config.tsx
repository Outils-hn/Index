import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Loader2,
  Plus,
  Pencil,
  Trash2,
  Check,
  X,
  Tags,
  Building2,
  MapPin,
} from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { ask } from "@/lib/confirm";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { QuickAddDialog } from "@/components/QuickAddDialog";
import { CategoryIconPicker } from "@/components/CategoryIconPicker";
import { getCategoryIcon } from "@/lib/category-icons";
import {
  fetchProjects,
  createProject,
  updateProject,
  deleteProject,
  type Project,
} from "@/lib/projects";
import { useAuth } from "@/hooks/use-auth";
import {
  fetchCategories,
  fetchSuppliers,
  createCategory,
  createSupplier,
  renameCategory,
  renameSupplier,
  deleteCategory,
  deleteSupplier,
  updateCategoryIcon,
  type Taxonomy,
} from "@/lib/taxonomies";

export const Route = createFileRoute("/config")({
  head: () => ({
    meta: [
      { title: "Configuration — Index" },
      { name: "description", content: "Gérer les catégories et fournisseurs." },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="mx-auto max-w-6xl px-6 py-16 flex items-center gap-3 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement de la session…
        </main>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />
      <main className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <div className="text-[11px] uppercase tracking-[0.08em] text-muted-foreground mb-1">
            Configuration
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Catégories & Fournisseurs</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Gérez les listes utilisées dans toute l'application.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <CategoriesPanel />
          <TaxonomyPanel
            title="Fournisseurs"
            icon={<Building2 className="h-4 w-4" />}
            queryKey="suppliers"
            fetcher={fetchSuppliers}
            creator={createSupplier}
            renamer={renameSupplier}
            remover={deleteSupplier}
            addLabel="Ajouter un fournisseur"
            placeholder="Ex. Sika"
          />
        </div>

        <div className="mt-8">
          <ProjectsPanel />
        </div>
      </main>
    </div>
  );
}

interface PanelProps {
  title: string;
  icon: React.ReactNode;
  queryKey: string;
  fetcher: () => Promise<Taxonomy[]>;
  creator: (name: string) => Promise<Taxonomy>;
  renamer: (id: string, name: string) => Promise<void>;
  remover: (id: string) => Promise<void>;
  addLabel: string;
  placeholder: string;
}

function TaxonomyPanel({
  title,
  icon,
  queryKey,
  fetcher,
  creator,
  renamer,
  remover,
  addLabel,
  placeholder,
}: PanelProps) {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: [queryKey],
    queryFn: fetcher,
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renamer(id, name),
    onSuccess: () => {
      toast.success("Renommé.");
      qc.invalidateQueries({ queryKey: [queryKey] });
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => remover(id),
    onSuccess: () => {
      toast.success("Supprimé.");
      qc.invalidateQueries({ queryKey: [queryKey] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (item: Taxonomy) => {
    setEditingId(item.id);
    setEditValue(item.name);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const name = editValue.trim();
    if (!name) {
      toast.error("Le nom est requis.");
      return;
    }
    renameMutation.mutate({ id: editingId, name });
  };

  return (
    <section>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 font-semibold">
            {icon}
            {title}
            <span className="text-muted-foreground font-normal text-sm">
              ({items.length})
            </span>
          </div>
          <Button size="sm" onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Ajouter
          </Button>
        </div>
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Aucune entrée pour le moment.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-2 px-5 py-3 hover:bg-secondary/40">
                {editingId === it.id ? (
                  <>
                    <Input
                      autoFocus
                      value={editValue}
                      maxLength={80}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 h-9"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={commitEdit}
                      disabled={renameMutation.isPending}
                      aria-label="Valider"
                    >
                      {renameMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      aria-label="Annuler"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 truncate">{it.name}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(it)}
                      aria-label="Renommer"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (await ask({ title: `Supprimer « ${it.name} » ?`, message: "Les fiches qui utilisent cette valeur la conserveront comme texte.", confirm: "Supprimer", danger: true })) {
                          deleteMutation.mutate(it.id);
                        }
                      }}
                      aria-label={`Supprimer ${it.name}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <QuickAddDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={addLabel}
        label="Nom"
        placeholder={placeholder}
        onSubmit={async (n) => {
          const c = await creator(n);
          qc.invalidateQueries({ queryKey: [queryKey] });
          return c;
        }}
      />
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* Categories panel — with icon picker                                         */
/* -------------------------------------------------------------------------- */

function CategoriesPanel() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["categories"],
    queryFn: fetchCategories,
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) => renameCategory(id, name),
    onSuccess: () => {
      toast.success("Renommé.");
      qc.invalidateQueries({ queryKey: ["categories"] });
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const iconMutation = useMutation({
    mutationFn: ({ id, icon }: { id: string; icon: string | null }) =>
      updateCategoryIcon(id, icon),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onSuccess: () => {
      toast.success("Supprimé.");
      qc.invalidateQueries({ queryKey: ["categories"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (item: Taxonomy) => {
    setEditingId(item.id);
    setEditValue(item.name);
  };

  const commitEdit = () => {
    if (!editingId) return;
    const name = editValue.trim();
    if (!name) {
      toast.error("Le nom est requis.");
      return;
    }
    renameMutation.mutate({ id: editingId, name });
  };

  return (
    <section>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 font-semibold">
            <Tags className="h-4 w-4" />
            Catégories
            <span className="text-muted-foreground font-normal text-sm">
              ({items.length})
            </span>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Ajouter
          </Button>
        </div>
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Aucune catégorie pour le moment.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((it) => {
              const Icon = getCategoryIcon(it.name, it.icon);
              return (
                <li
                  key={it.id}
                  className="flex items-center gap-2 px-5 py-3 hover:bg-secondary/40"
                >
                  <CategoryIconPicker
                    value={it.icon ?? null}
                    name={it.name}
                    size="sm"
                    onChange={(key) => iconMutation.mutate({ id: it.id, icon: key })}
                  />
                  {editingId === it.id ? (
                    <>
                      <Input
                        autoFocus
                        value={editValue}
                        maxLength={80}
                        onChange={(e) => setEditValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        className="flex-1 h-9"
                      />
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={commitEdit}
                        disabled={renameMutation.isPending}
                        aria-label="Valider"
                      >
                        {renameMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Check className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => setEditingId(null)}
                        aria-label="Annuler"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 truncate flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                        {it.name}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => startEdit(it)}
                        aria-label="Renommer"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={async () => {
                          if (await ask({ title: `Supprimer « ${it.name} » ?`, message: "Les fiches qui utilisent cette valeur la conserveront comme texte.", confirm: "Supprimer", danger: true })) {
                            deleteMutation.mutate(it.id);
                          }
                        }}
                        aria-label={`Supprimer ${it.name}`}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <AddCategoryDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["categories"] })}
      />
    </section>
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
/* Projects panel                                                             */
/* -------------------------------------------------------------------------- */

function ProjectsPanel() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editNumero, setEditNumero] = useState("");
  const [editNom, setEditNom] = useState("");

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: fetchProjects,
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, numero, nom }: { id: string; numero: string; nom: string }) =>
      updateProject(id, numero, nom),
    onSuccess: () => {
      toast.success("Projet mis à jour.");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteProject(id),
    onSuccess: () => {
      toast.success("Projet supprimé.");
      qc.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (it: Project) => {
    setEditingId(it.id);
    setEditNumero(it.numero);
    setEditNom(it.nom);
  };

  const commitEdit = () => {
    if (!editingId) return;
    if (!editNumero.trim() || !editNom.trim()) {
      toast.error("Numéro et nom requis.");
      return;
    }
    renameMutation.mutate({ id: editingId, numero: editNumero, nom: editNom });
  };

  return (
    <section>
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 font-semibold">
            <MapPin className="h-4 w-4" />
            Projets / Chantiers
            <span className="text-muted-foreground font-normal text-sm">
              ({items.length})
            </span>
          </div>
          <Button size="sm" onClick={() => setAddOpen(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Ajouter
          </Button>
        </div>
        {isLoading ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Chargement…
          </div>
        ) : items.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm text-muted-foreground">
            Aucun projet pour le moment.
          </div>
        ) : (
          <ul className="divide-y divide-border">
            {items.map((it) => (
              <li key={it.id} className="flex items-center gap-2 px-5 py-3 hover:bg-secondary/40">
                {editingId === it.id ? (
                  <>
                    <Input
                      value={editNumero}
                      onChange={(e) => setEditNumero(e.target.value)}
                      className="h-9 w-28 font-mono"
                      placeholder="Numéro"
                    />
                    <Input
                      autoFocus
                      value={editNom}
                      onChange={(e) => setEditNom(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitEdit();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="flex-1 h-9"
                      placeholder="Nom"
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={commitEdit}
                      disabled={renameMutation.isPending}
                      aria-label="Valider"
                    >
                      {renameMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setEditingId(null)}
                      aria-label="Annuler"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <span className="font-mono text-xs text-muted-foreground w-20 shrink-0">
                      {it.numero}
                    </span>
                    <span className="flex-1 truncate">{it.nom}</span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => startEdit(it)}
                      aria-label="Modifier"
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={async () => {
                        if (await ask({ title: `Supprimer le chantier « ${it.numero} ${it.nom} » ?`, message: "Les fiches associées perdront ce lien.", confirm: "Supprimer", danger: true })) {
                          deleteMutation.mutate(it.id);
                        }
                      }}
                      aria-label={`Supprimer ${it.numero} ${it.nom}`}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <AddProjectDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        onCreated={() => qc.invalidateQueries({ queryKey: ["projects"] })}
      />
    </section>
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
