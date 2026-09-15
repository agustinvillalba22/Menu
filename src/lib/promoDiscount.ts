import type { PublicItem, PublicPromo } from './types'

/**
 * Promo-discount rule (Fase 0010) — the exact client-side mirror of the
 * backend's `services/promo.py::promo_discount_pct`. One shared rule so the
 * cart/checkout totals the guest sees match what the server recomputes at
 * POST; the server stays authoritative.
 */

/** The % this promo applies to this item's lines, or null (no discount). */
export function promoDiscountPct(
  promo: PublicPromo | null | undefined,
  item: Pick<PublicItem, 'id' | 'category_id'>,
): number | null {
  if (promo === null || promo === undefined) return null
  if (promo.discount_pct === null || promo.discount_pct <= 0) return null
  switch (promo.scope) {
    case 'none':
      return null
    case 'item':
      return promo.item_id === item.id ? promo.discount_pct : null
    case 'category':
      return promo.category_id === item.category_id ? promo.discount_pct : null
    case 'catalog':
      return promo.discount_pct
  }
}

/**
 * Apply a whole-number % discount, rounded to cents (half-up) — matches the
 * server's Decimal quantize so both sides land on the same cent.
 */
export function applyDiscount(value: number, pct: number): number {
  return Math.round(value * (100 - pct)) / 100
}
