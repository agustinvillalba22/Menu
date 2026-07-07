import type { PublicTag } from '../../lib/types'

/**
 * Heuristic badge derivation from tag names (case-insensitive substring match).
 * Purely presentational: it adds an emoji to well-known dietary tags without
 * touching the backend schema. Unknown tags render with no emoji.
 */
const BADGE_RULES: { emoji: string; keywords: string[] }[] = [
  { emoji: '🌶️', keywords: ['picante', 'spicy', 'hot'] },
  { emoji: '🌱', keywords: ['vegetariano', 'vegetariana', 'veggie', 'vegano', 'vegana', 'vegan'] },
  { emoji: '🌾', keywords: ['sin gluten', 'sin tacc', 'gluten free', 'gluten-free', 'celiac'] },
]

export function badgeEmoji(tag: PublicTag): string | null {
  const name = tag.name.toLowerCase()
  for (const rule of BADGE_RULES) {
    if (rule.keywords.some((k) => name.includes(k))) return rule.emoji
  }
  return null
}
