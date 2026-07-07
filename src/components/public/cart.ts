import { useCallback, useEffect, useState } from 'react'
import type { PublicItem, PublicModifier } from '../../lib/types'

/** A single configured line in the public cart (item + chosen modifiers). */
export interface CartLine {
  lineId: string
  item: PublicItem
  quantity: number
  modifiers: PublicModifier[]
  specialInstructions?: string
}

/** localStorage key is namespaced per qrToken so carts don't leak across restaurants. */
export function cartStorageKey(qrToken: string): string {
  return `boulette_cart_${qrToken}`
}

/** Stable id for a line: same item + same set of modifiers collapse into one line. */
export function makeLineId(item: PublicItem, modifiers: PublicModifier[]): string {
  const ids = modifiers.map((m) => m.id).sort()
  return `${item.id}::${ids.join('-')}`
}

/** Per-unit price = base price + sum of chosen deltas (deltas may be negative). */
export function lineUnitPrice(line: CartLine): number {
  const base = parseFloat(line.item.price)
  const deltas = line.modifiers.reduce((sum, m) => sum + parseFloat(m.price_delta), 0)
  return base + deltas
}

export function lineTotal(line: CartLine): number {
  return lineUnitPrice(line) * line.quantity
}

export function cartTotal(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + lineTotal(l), 0)
}

export function cartCount(lines: CartLine[]): number {
  return lines.reduce((sum, l) => sum + l.quantity, 0)
}

export function formatPrice(value: number): string {
  return value.toFixed(2)
}

interface UsePublicCart {
  lines: CartLine[]
  count: number
  total: number
  addLine: (item: PublicItem, modifiers: PublicModifier[], quantity: number, note?: string) => void
  updateQuantity: (lineId: string, delta: number) => void
  removeLine: (lineId: string) => void
  clear: () => void
}

/**
 * Cart state persisted to localStorage under a qrToken-scoped key. Reloads when
 * the token changes so scanning a different restaurant starts a fresh cart.
 */
export function usePublicCart(qrToken: string | undefined): UsePublicCart {
  const [lines, setLines] = useState<CartLine[]>([])

  useEffect(() => {
    if (qrToken === undefined) {
      setLines([])
      return
    }
    try {
      const raw = localStorage.getItem(cartStorageKey(qrToken))
      setLines(raw ? (JSON.parse(raw) as CartLine[]) : [])
    } catch {
      setLines([])
    }
  }, [qrToken])

  const persist = useCallback(
    (next: CartLine[]) => {
      setLines(next)
      if (qrToken === undefined) return
      try {
        localStorage.setItem(cartStorageKey(qrToken), JSON.stringify(next))
      } catch {
        // storage unavailable (private mode / quota): keep in-memory state only.
      }
    },
    [qrToken],
  )

  const addLine = useCallback(
    (item: PublicItem, modifiers: PublicModifier[], quantity: number, note?: string) => {
      const lineId = makeLineId(item, modifiers)
      setLines((prev) => {
        const idx = prev.findIndex((l) => l.lineId === lineId)
        let next: CartLine[]
        if (idx > -1) {
          next = prev.map((l, i) =>
            i === idx
              ? {
                  ...l,
                  quantity: l.quantity + quantity,
                  specialInstructions: mergeNotes(l.specialInstructions, note),
                }
              : l,
          )
        } else {
          next = [...prev, { lineId, item, modifiers, quantity, specialInstructions: note }]
        }
        if (qrToken !== undefined) {
          try {
            localStorage.setItem(cartStorageKey(qrToken), JSON.stringify(next))
          } catch {
            // ignored
          }
        }
        return next
      })
    },
    [qrToken],
  )

  const updateQuantity = useCallback(
    (lineId: string, delta: number) => {
      persist(
        lines
          .map((l) => (l.lineId === lineId ? { ...l, quantity: l.quantity + delta } : l))
          .filter((l) => l.quantity > 0),
      )
    },
    [lines, persist],
  )

  const removeLine = useCallback(
    (lineId: string) => {
      persist(lines.filter((l) => l.lineId !== lineId))
    },
    [lines, persist],
  )

  const clear = useCallback(() => persist([]), [persist])

  return {
    lines,
    count: cartCount(lines),
    total: cartTotal(lines),
    addLine,
    updateQuantity,
    removeLine,
    clear,
  }
}

function mergeNotes(existing: string | undefined, incoming: string | undefined): string | undefined {
  if (!incoming) return existing
  if (!existing) return incoming
  return `${existing} | ${incoming}`
}
