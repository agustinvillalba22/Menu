import type { PublicTag } from '../../lib/types'

export interface Badge {
  emoji: string
  colorClass: string
}

/**
 * Heuristic badge derivation from tag names (case-insensitive substring match).
 * Purely presentational: it adds an emoji + a distinctive Tailwind color class
 * to well-known dietary tags without touching the backend schema. Unknown
 * tags render with no badge (fallback to the plain gray chip).
 */
const BADGE_RULES: { emoji: string; colorClass: string; keywords: string[] }[] = [
  {
    emoji: '🌶️',
    colorClass: 'bg-red-50 text-red-600 border-red-200',
    keywords: ['picante', 'spicy', 'hot'],
  },
  {
    emoji: '🌱',
    colorClass: 'bg-emerald-50 text-emerald-600 border-emerald-200',
    keywords: ['vegetariano', 'vegetariana', 'veggie'],
  },
  {
    emoji: '🌿',
    colorClass: 'bg-green-50 text-green-600 border-green-200',
    keywords: ['vegano', 'vegana', 'vegan'],
  },
  {
    emoji: '🌾',
    colorClass: 'bg-amber-50 text-amber-600 border-amber-200',
    keywords: ['sin gluten', 'sin tacc', 'gluten free', 'gluten-free', 'celiac'],
  },
  {
    emoji: '🥛',
    colorClass: 'bg-sky-50 text-sky-600 border-sky-200',
    keywords: ['sin lácteos', 'sin lacteos', 'dairy free', 'dairy-free'],
  },
]

export function badgeInfo(tag: PublicTag): Badge | null {
  const name = tag.name.toLowerCase()
  for (const rule of BADGE_RULES) {
    if (rule.keywords.some((k) => name.includes(k))) {
      return { emoji: rule.emoji, colorClass: rule.colorClass }
    }
  }
  return null
}
