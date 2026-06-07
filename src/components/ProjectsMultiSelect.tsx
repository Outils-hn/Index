import { useState } from "react";
import { Check, ChevronDown, MapPin, Plus, X, Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { createProject, type Project } from "@/lib/projects";

interface Props {
  projects: Project[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
}

export function ProjectsMultiSelect({ projects, selectedIds, onChange }: Props) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [numero, setNumero] = useState("");
  const [nom, setNom] = useState("");

  const selected = projects.filter((p) => selectedIds.includes(p.id));
  const q = filter.trim().toLowerCase();
  const filtered = q
    ? projects.filter(
        (p) =>
          p.numero.toLowerCase().includes(q) || p.nom.toLowerCase().includes(q),
      )
    : projects;

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((i) => i !== id));
    else onChange([...selectedIds, id]);
  };

  const createMutation = useMutation({
    mutationFn: () => createProject(numero, nom),
    onSuccess: (p) => {
      toast.success("Projet créé.");
      qc.invalidateQueries({ queryKey: ["projects"] });
      onChange([...selectedIds, p.id]);
      setNumero("");
      setNom("");
      setCreateOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              className="flex-1 justify-between font-normal"
            >
              <span className="truncate text-left">
                {selected.length === 0
                  ? "Sélectionner des projets…"
                  : `${selected.length} projet${selected.length > 1 ? "s" : ""} sélectionné${selected.length > 1 ? "s" : ""}`}
              </span>
              <ChevronDown className="h-4 w-4 opacity-50 shrink-0" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-[--radix-popover-trigger-width]" align="start">
            <div className="p-2 border-b">
              <Input
                autoFocus
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Rechercher un projet…"
                className="h-8"
              />
            </div>
            <ul className="max-h-60 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <li className="px-3 py-4 text-center text-xs text-muted-foreground">
                  Aucun projet
                </li>
              ) : (
                filtered.map((p) => {
                  const isSel = selectedIds.includes(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => toggle(p.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary text-left"
                      >
                        <span className="w-4 flex justify-center">
                          {isSel && <Check className="h-3.5 w-3.5 text-accent" />}
                        </span>
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <span className="font-mono text-xs text-muted-foreground">
                          {p.numero}
                        </span>
                        <span className="truncate">{p.nom}</span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </PopoverContent>
        </Popover>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setCreateOpen(true)}
          aria-label="Nouveau projet"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((p) => (
            <Badge
              key={p.id}
              variant="secondary"
              className="gap-1.5 pl-2 pr-1 py-0.5 font-normal"
            >
              <MapPin className="h-3 w-3" />
              <span className="font-mono text-[10px]">{p.numero}</span>
              <span>{p.nom}</span>
              <button
                type="button"
                onClick={() => toggle(p.id)}
                className="ml-0.5 rounded hover:bg-background/60 p-0.5"
                aria-label="Retirer"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau projet / chantier</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!numero.trim() || !nom.trim()) {
                toast.error("Numéro et nom requis.");
                return;
              }
              createMutation.mutate();
            }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label htmlFor="proj-num">Numéro de projet</Label>
              <Input
                id="proj-num"
                autoFocus
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="Ex. 4144D"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="proj-nom">Nom du projet</Label>
              <Input
                id="proj-nom"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                placeholder="Ex. Onyx"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setCreateOpen(false)}>
                Annuler
              </Button>
              <Button type="submit" disabled={createMutation.isPending}>
                {createMutation.isPending && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                Créer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}