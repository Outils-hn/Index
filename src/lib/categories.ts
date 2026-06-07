export const CATEGORIES = [
  { value: "colles_mastics", label: "Colles & Mastics" },
  { value: "fixations_chevilles", label: "Fixations & Chevilles" },
  { value: "membranes_etancheite", label: "Membranes & Étanchéité" },
  { value: "profiles_accessoires", label: "Profilés & Accessoires" },
  { value: "isolants", label: "Isolants" },
] as const;

export type CategoryValue = (typeof CATEGORIES)[number]["value"];

export const categoryLabel = (v: string) =>
  CATEGORIES.find((c) => c.value === v)?.label ?? v;

export const SUPPLIERS = [
  "Sika",
  "Bostik",
  "Hilti",
  "Fischer",
  "Soprema",
  "Knauf",
  "Rockwool",
  "Saint-Gobain",
  "Wienerberger",
  "Tremco",
  "Autre",
];