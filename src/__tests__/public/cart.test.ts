import { beforeEach, describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { cartStorageKey, usePublicCart } from '../../components/public/cart'
import type { PublicItem, PublicModifier } from '../../lib/types'

beforeEach(() => {
  localStorage.clear()
})

const item: PublicItem = {
  id: 'i1',
  name: 'Margherita',
  description: 'Tomate y mozzarella',
  price: '10.00',
  image_url: null,
  tags: [],
  modifiers: [],
}

const extra: PublicModifier = { id: 'm1', name: 'Extra queso', price_delta: '1.50', type: 'extra' }

describe('usePublicCart', () => {
  it('persists the cart in localStorage under a qrToken-scoped key', () => {
    const { result } = renderHook(() => usePublicCart('token-a'))

    act(() => {
      result.current.addLine(item, [extra], 2)
    })

    expect(result.current.count).toBe(2)
    // (10.00 + 1.50) * 2 = 23.00
    expect(result.current.total).toBeCloseTo(23)

    const raw = localStorage.getItem(cartStorageKey('token-a'))
    expect(raw).not.toBeNull()
    const stored = JSON.parse(raw as string)
    expect(stored).toHaveLength(1)
    expect(stored[0].item.id).toBe('i1')
    expect(stored[0].quantity).toBe(2)
  })

  it('does not share the cart between two different qrTokens', () => {
    // Fill the cart for token-a.
    const { result: cartA } = renderHook(() => usePublicCart('token-a'))
    act(() => {
      cartA.current.addLine(item, [], 1)
    })
    expect(cartA.current.count).toBe(1)

    // A fresh cart for token-b starts empty and has its own storage key.
    const { result: cartB } = renderHook(() => usePublicCart('token-b'))
    expect(cartB.current.count).toBe(0)
    expect(cartB.current.lines).toHaveLength(0)

    expect(localStorage.getItem(cartStorageKey('token-b'))).toBeNull()
    expect(localStorage.getItem(cartStorageKey('token-a'))).not.toBeNull()
  })

  it('reloads an existing cart from localStorage when mounted for the same token', () => {
    const { result: first } = renderHook(() => usePublicCart('token-a'))
    act(() => {
      first.current.addLine(item, [], 3)
    })

    // A brand new hook instance for the same token rehydrates the saved lines.
    const { result: second } = renderHook(() => usePublicCart('token-a'))
    expect(second.current.count).toBe(3)
    expect(second.current.lines[0].item.id).toBe('i1')
  })
})
