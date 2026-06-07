import { Check } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  CATEGORY_ICON_OPTIONS,
  DEFAULT_CATEGORY_ICON,
  getCategoryIcon,
} from "@/lib/category-icons";

interface Props {
  value: string | null;
  onChange: (key: string | null) => void;
  /** Category name, used only for the fallback visual when no key is chosen. */
  name?: string;
  size?: "sm" | "md";
  align?: "start" | "center" | "end";
}

export function CategoryIconPicker({
  value,
  onChange,
  name = "",
  size = "md",
  align = "start",
}: Props) {
  const Current = value ? getCategoryIcon(name, value) : DEFAULT_CATEGORY_ICON;
  const dim = size === "sm" ? "h-9 w-9" : "h-10 w-10";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={`${dim} p-0 shrink-0`}
          aria-label="Choisir une icône"
          title="Choisir une icône"
        >
          <Current className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-medium text-foreground">Icône de la catégorie</div>
          {value && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2"
            >
              Réinitialiser
            </button>
          )}
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {CATEGORY_ICON_OPTIONS.map(({ key, Icon }) => {
            const active = key === value;
            return (
              <button
                key={key}
                type="button"
                onClick={() => onChange(key)}
                className={`relative h-9 w-9 grid place-items-center rounded-md border transition ${
                  active
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border bg-background hover:bg-secondary text-foreground/80"
                }`}
                aria-label={key}
                title={key}
              >
                <Icon className="h-4 w-4" />
                {active && (
                  <Check className="absolute -top-1 -right-1 h-3 w-3 bg-primary text-primary-foreground rounded-full p-[1px]" />
                )}
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}