import {
  Tag,
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
  Ruler,
  HardHat,
  Lightbulb,
  Sparkles,
  TreePine,
  Snowflake,
  Sun,
  Brush,
  Cog,
  Anchor,
  Lock,
  type LucideIcon,
} from "lucide-react";

export const CATEGORY_ICON_REGISTRY: Record<string, LucideIcon> = {
  Tag,
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
  Ruler,
  HardHat,
  Lightbulb,
  Sparkles,
  TreePine,
  Snowflake,
  Sun,
  Brush,
  Cog,
  Anchor,
  Lock,
};

export const DEFAULT_CATEGORY_ICON = "Tag";

export const CATEGORY_ICON_NAMES = Object.keys(CATEGORY_ICON_REGISTRY);

export function getCategoryIcon(iconName?: string | null): LucideIcon {
  if (!iconName) return CATEGORY_ICON_REGISTRY[DEFAULT_CATEGORY_ICON];
  return CATEGORY_ICON_REGISTRY[iconName] ?? CATEGORY_ICON_REGISTRY[DEFAULT_CATEGORY_ICON];
}