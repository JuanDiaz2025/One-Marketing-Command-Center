import {
  Briefcase,
  Ellipsis,
  HeartPulse,
  ShoppingBag,
  Sparkles,
  Store,
  UtensilsCrossed,
  Wrench,
  type LucideIcon,
} from "lucide-react"

import type { CategoryValue } from "@/lib/setup"

type CategoryVisual = {
  icon: LucideIcon
  // Icon chip on the category tile.
  chip: string
  // Tile border and wash when selected.
  selected: string
}

export const categoryVisuals: Record<CategoryValue, CategoryVisual> = {
  restaurant: {
    icon: UtensilsCrossed,
    chip: "bg-orange-100 text-orange-600",
    selected: "has-checked:border-orange-400 has-checked:bg-orange-50",
  },
  retail: {
    icon: Store,
    chip: "bg-sky-100 text-sky-600",
    selected: "has-checked:border-sky-400 has-checked:bg-sky-50",
  },
  "online-store": {
    icon: ShoppingBag,
    chip: "bg-fuchsia-100 text-fuchsia-600",
    selected: "has-checked:border-fuchsia-400 has-checked:bg-fuchsia-50",
  },
  "home-services": {
    icon: Wrench,
    chip: "bg-emerald-100 text-emerald-600",
    selected: "has-checked:border-emerald-400 has-checked:bg-emerald-50",
  },
  health: {
    icon: HeartPulse,
    chip: "bg-cyan-100 text-cyan-700",
    selected: "has-checked:border-cyan-400 has-checked:bg-cyan-50",
  },
  beauty: {
    icon: Sparkles,
    chip: "bg-pink-100 text-pink-600",
    selected: "has-checked:border-pink-400 has-checked:bg-pink-50",
  },
  professional: {
    icon: Briefcase,
    chip: "bg-indigo-100 text-indigo-600",
    selected: "has-checked:border-indigo-400 has-checked:bg-indigo-50",
  },
  other: {
    icon: Ellipsis,
    chip: "bg-violet-100 text-violet-600",
    selected: "has-checked:border-violet-400 has-checked:bg-violet-50",
  },
}
