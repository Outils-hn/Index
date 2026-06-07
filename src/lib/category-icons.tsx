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
  type LucideIcon,
} from "lucide-react";

const RULES: Array<{ match: RegExp; icon: LucideIcon }> = [
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

export function getCategoryIcon(name: string): LucideIcon {
  for (const r of RULES) if (r.match.test(name)) return r.icon;
  return Layers;
}