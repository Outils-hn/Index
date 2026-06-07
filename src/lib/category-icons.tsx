import {
  Layers,
  Box,
  Wrench,
  Droplets,
  Flame,
  Wind,
  PaintBucket,
  Hammer,
  Square,
  Scroll,
  Building2,
  Zap,
  Shield,
  Package,
  Tag,
  Folder,
  Hexagon,
  Pipette,
  Ruler,
  Brush,
  Cog,
  Lightbulb,
  Thermometer,
  TreePine,
  Layers3,
  Anchor,
  type LucideIcon,
} from "lucide-react";

/**
 * Registry of icons that can be picked for a category.
 * The "key" is what is persisted in the `categories.icon` column.
 */
export const CATEGORY_ICON_REGISTRY: Record<string, LucideIcon> = {
  tag: Tag,
  folder: Folder,
  layers: Layers,
  layers3: Layers3,
  package: Package,
  box: Box,
  hexagon: Hexagon,
  square: Square,
  scroll: Scroll,
  wrench: Wrench,
  hammer: Hammer,
  cog: Cog,
  ruler: Ruler,
  anchor: Anchor,
  droplets: Droplets,
  pipette: Pipette,
  paint: PaintBucket,
  brush: Brush,
  flame: Flame,
  thermometer: Thermometer,
  wind: Wind,
  zap: Zap,
  lightbulb: Lightbulb,
  shield: Shield,
  building: Building2,
  tree: TreePine,
};

export const CATEGORY_ICON_OPTIONS: Array<{ key: string; Icon: LucideIcon }> =
  Object.entries(CATEGORY_ICON_REGISTRY).map(([key, Icon]) => ({ key, Icon }));

export const DEFAULT_CATEGORY_ICON: LucideIcon = Tag;

const FALLBACK_RULES: Array<{ match: RegExp; icon: LucideIcon }> = [
  { match: /membran|étanch|etanch|rouleau/i, icon: Scroll },
  { match: /isol|laine|mousse/i, icon: Box },
  { match: /bardage|panneau|façade|facade/i, icon: Square },
  { match: /fixation|vis|ancrage|cheville/i, icon: Wrench },
  { match: /coll|mastic|joint|silicon/i, icon: Droplets },
  { match: /feu|coupe.?feu|ignif/i, icon: Flame },
  { match: /vent|aérat|aerat/i, icon: Wind },
  { match: /peintur|enduit|finition/i, icon: PaintBucket },
  { match: /outil|machine/i, icon: Hammer },
  { match: /structur|ossatur|metal|métal/i, icon: Building2 },
  { match: /élec|elec|cable|câble/i, icon: Zap },
  { match: /protect|sécur|secur/i, icon: Shield },
  { match: /access/i, icon: Package },
];

/**
 * Resolve a Lucide icon for a category. If an explicit `iconKey` from the
 * database is provided, use it. Otherwise fall back to a name-based guess,
 * and finally to the default neutral icon.
 */
export function getCategoryIcon(name: string, iconKey?: string | null): LucideIcon {
  if (iconKey && CATEGORY_ICON_REGISTRY[iconKey]) return CATEGORY_ICON_REGISTRY[iconKey];
  for (const r of FALLBACK_RULES) if (r.match.test(name)) return r.icon;
  return DEFAULT_CATEGORY_ICON;
}