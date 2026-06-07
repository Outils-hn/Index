import { Check } from "lucide-react";
import {
  CATEGORY_ICON_NAMES,
  CATEGORY_ICON_REGISTRY,
} from "@/lib/category-icons";
import { cn } from "@/lib/utils";

interface Props {
  value: string | null;
  onChange: (icon: string | null) => void;
}

export function CategoryIconPicker({ value, onChange }: Props) {
  return (
    <div className="grid grid-cols-8 gap-1.5 p-2 rounded-md border border-border bg-secondary/30 max-h-44 overflow-y-auto">
      {CATEGORY_ICON_NAMES.map((name) => {
        const Icon = CATEGORY_ICON_REGISTRY[name];
        const active = value === name;
        return (
          <button
            type="button"
            key={name}
            onClick={() => onChange(active ? null : name)}
            title={name}
            className={cn(
              "relative h-8 w-8 rounded grid place-items-center transition border",
              active
                ? "bg-accent text-accent-foreground border-accent"
                : "bg-card text-muted-foreground border-border hover:text-foreground hover:border-accent/40",
            )}
          >
            <Icon className="h-4 w-4" />
            {active && (
              <Check className="absolute -top-1 -right-1 h-3 w-3 bg-accent text-accent-foreground rounded-full p-[1px]" />
            )}
          </button>
        );
      })}
    </div>
  );
}