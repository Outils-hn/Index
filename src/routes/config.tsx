import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus, Pencil, Trash2, Check, X, Tags, Building2 } from "lucide-react";
import { toast } from "sonner";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuickAddDialog } from "@/components/QuickAddDialog";
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
  type Taxonomy,
} from "@/lib/taxonomies";

export const Route = createFileRoute("/config")({
  head: () => ({
    meta: [
      { title: "Configuration — FaçadeTech" },
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
          <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground mb-1">
            Configuration
          </div>
          <h1 className="text-2xl font-bold tracking-tight">Catégories & Fournisseurs</h1>
          <p className="text-muted-foreground mt-1.5 text-sm">
            Gérez les listes utilisées dans toute l'application.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <TaxonomyPanel
            title="Catégories"
            icon={<Tags className="h-4 w-4" />}
            queryKey="categories"
            fetcher={fetchCategories}
            creator={createCategory}
            renamer={renameCategory}
            remover={deleteCategory}
            addLabel="Ajouter une catégorie"
            placeholder="Ex. Isolants"
          />
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
                      onClick={() => {
                        if (confirm(`Supprimer "${it.name}" ? Les produits utilisant cette valeur la conserveront comme texte.`)) {
                          deleteMutation.mutate(it.id);
                        }
                      }}
                      aria-label="Supprimer"
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