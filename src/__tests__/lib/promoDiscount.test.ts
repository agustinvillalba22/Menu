import { describe, expect, it } from 'vitest'
import { applyDiscount, promoDiscountPct } from '../../lib/promoDiscount'
import type { PublicPromo } from '../../lib/types'

const promoBase: PublicPromo = {
  id: 'p1',
  title: '2x1 Pizzas',
  subtitle: null,
  description: null,
  discount_pct: 20,
  image_url: null,
  scope: 'item',
  item_id: 'i1',
  category_id: null,
}

const item = { id: 'i1', category_id: 'c1' }
const other = { id: 'i2', category_id: 'c2' }

describe('promoDiscountPct — exact mirror of the server rule', () => {
  it('applies to the linked item only (scope=item)', () => {
    expect(promoDiscountPct(promoBase, item)).toBe(20)
    expect(promoDiscountPct(promoBase, other)).toBeNull()
  })

  it('applies to every item of the linked category (scope=category)', () => {
    const promo: PublicPromo = {
      ...promoBase,
      scope: 'category',
      item_id: null,
      category_id: 'c1',
    }
    expect(promoDiscountPct(promo, item)).toBe(20)
    expect(promoDiscountPct(promo, { id: 'i3', category_id: 'c1' })).toBe(20)
    expect(promoDiscountPct(promo, other)).toBeNull()
  })

  it('applies to everything (scope=catalog)', () => {
    const promo: PublicPromo = { ...promoBase, scope: 'catalog', item_id: null }
    expect(promoDiscountPct(promo, item)).toBe(20)
    expect(promoDiscountPct(promo, other)).toBe(20)
  })

  it('never discounts with scope=none, no pct, or no promo', () => {
    expect(promoDiscountPct({ ...promoBase, scope: 'none', item_id: null }, item)).toBeNull()
    expect(promoDiscountPct({ ...promoBase, discount_pct: null }, item)).toBeNull()
    expect(promoDiscountPct({ ...promoBase, discount_pct: 0 }, item)).toBeNull()
    expect(promoDiscountPct(null, item)).toBeNull()
    expect(promoDiscountPct(undefined, item)).toBeNull()
  })
})

describe('applyDiscount — cent-exact with the server (half-up)', () => {
  it('rounds to cents the same way the backend Decimal quantize does', () => {
    expect(applyDiscount(10, 20)).toBe(8)
    expect(applyDiscount(10, 25)).toBe(7.5)
    expect(applyDiscount(11.5, 20)).toBe(9.2) // (10.00 + 1.50) * 0.8
    expect(applyDiscount(9.99, 33)).toBe(6.69) // 6.6933 -> 6.69
    expect(applyDiscount(9.99, 15)).toBe(8.49) // 8.4915 -> 8.49
  })
})
