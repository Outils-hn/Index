import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { CategoryIconPicker } from "@/components/CategoryIconPicker";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  title: string;
  description?: string;
  label: string;
  placeholder?: string;
  withIconPicker?: boolean;
  onSubmit: (name: string, icon?: string | null) => Promise<{ name: string }>;
  onCreated?: (name: string) => void;
}

export function QuickAddDialog({
  open,
  onOpenChange,
  title,
  description,
  label,
  placeholder,
  withIconPicker,
  onSubmit,
  onCreated,
}: Props) {
  const [value, setValue] = useState("");
  const [icon, setIcon] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = value.trim();
    if (!name) return;
    if (name.length > 80) {
      toast.error("Le nom doit faire moins de 80 caractères.");
      return;
    }
    setLoading(true);
    try {
      const created = await onSubmit(name, withIconPicker ? icon : undefined);
      toast.success("Ajouté.");
      onCreated?.(created.name);
      setValue("");
      setIcon(null);
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message ?? "Erreur lors de l'ajout.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="quick-add-name">{label}</Label>
            <Input
              id="quick-add-name"
              autoFocus
              maxLength={80}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={placeholder}
            />
          </div>
          {withIconPicker && (
            <div className="space-y-2">
              <Label>Icône (optionnel)</Label>
              <CategoryIconPicker value={icon} onChange={setIcon} />
              <p className="text-xs text-muted-foreground">
                Une icône neutre est utilisée par défaut.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Annuler
            </Button>
            <Button type="submit" disabled={loading || !value.trim()}>
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Ajouter
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}