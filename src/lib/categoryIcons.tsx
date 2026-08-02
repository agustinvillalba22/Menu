import {
  Beef,
  Beer,
  Cake,
  ChefHat,
  ClipboardList,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Drumstick,
  Fish,
  Flame,
  GlassWater,
  IceCream,
  MoreHorizontal,
  Pizza,
  Salad,
  Sandwich,
  Soup,
  Sparkles,
  Utensils,
  Wine,
  type LucideIcon,
} from 'lucide-react'
import type { CategoryIcon } from './types'

/**
 * Map of curated category icon keys → Lucide components (P8).
 *
 * The backend `CategoryIcon` enum is the source-of-truth for *which* keys
 * are allowed (and is mirrored in `lib/types.ts`). This file is the single
 * place that decides *how* a key renders on the public menu and in the
 * dashboard picker. Adding a new icon means: bump both the backend enum and
 * this map.
 *
 * A handful of keys are mapped onto close-enough Lucide components where the
 * 1:1 name is unavailable in this lucide-react version:
 *  - `bread`    → `Sandwich`
 *  - `cookies` → `Cookie` (lucide ships only the singular name)
 *  - `chicken` → `Drumstick`
 *
 * Frontend-facing label list (`getCategoryIconOptions`) is Spanish so a
 * an owner scanning the picker reads food terms in their own language.
 */
const ICON_MAP: Record<CategoryIcon, LucideIcon> = {
  utensils: Utensils,
  glass_water: GlassWater,
  pizza: Pizza,
  beer: Beer,
  wine: Wine,
  cake: Cake,
  coffee: Coffee,
  ice_cream: IceCream,
  salad: Salad,
  soup: Soup,
  fish: Fish,
  beef: Beef,
  chicken: Drumstick, // Drumstick stands in for `chicken` (Chicken not shipped here)
  bread: Sandwich, // Sandwich stands in for `bread` (Bread* not shipped here)
  cookies: Cookie, // Lucide ships only the singular `Cookie`
  croissant: Croissant,
  flame: Flame,
  sparkles: Sparkles,
  chef_hat: ChefHat,
  cup_soda: CupSoda,
  more_horizontal: MoreHorizontal,
  clipboard_list: ClipboardList,
}

/**
 * Builds the dashboard picker options list. Frontend-facing labels are in
 * Spanish with the icon key in parens so an owner scanning a long list can
 * locate a key consistently with how the public menu reads it back.
 */
const ICON_OPTIONS: Array<{ id: CategoryIcon; label: string }> = [
  { id: 'utensils', label: 'Cubiertos' },
  { id: 'glass_water', label: 'Vaso de agua' },
  { id: 'pizza', label: 'Pizza' },
  { id: 'beer', label: 'Cerveza' },
  { id: 'wine', label: 'Vino' },
  { id: 'cake', label: 'Torta' },
  { id: 'coffee', label: 'Café' },
  { id: 'ice_cream', label: 'Helado' },
  { id: 'salad', label: 'Ensalada' },
  { id: 'soup', label: 'Sopa' },
  { id: 'fish', label: 'Pescado' },
  { id: 'beef', label: 'Carne' },
  { id: 'chicken', label: 'Pollo' },
  { id: 'bread', label: 'Pan' },
  { id: 'cookies', label: 'Galletas' },
  { id: 'croissant', label: 'Medialuna' },
  { id: 'flame', label: 'Fuego' },
  { id: 'sparkles', label: 'Destello' },
  { id: 'chef_hat', label: 'Gorro de chef' },
  { id: 'cup_soda', label: 'Vaso de soda' },
  { id: 'more_horizontal', label: 'Más' },
  { id: 'clipboard_list', label: 'Carta' },
]

export function getCategoryIcon(id: CategoryIcon): LucideIcon {
  const Icon = ICON_MAP[id]
  if (Icon === undefined) {
    // Should not happen: backend validates against the same union before
    // storing. Let the error surface so a schema drift is loud, not silent.
    throw new Error(`Unknown category icon: ${id as string}`)
  }
  return Icon
}

export function getCategoryIconOptions(): Array<{ id: CategoryIcon; label: string }> {
  return ICON_OPTIONS
}

/** Sentinel used by `<select>` value to encode "no icon selected". */
export const NO_ICON_VALUE = '__none__'