import { useEffect, useState } from 'react'
import { listOrders } from '../lib/orders'
import { getCurrentShift } from '../lib/shifts'
import { listStockItems } from '../lib/stockItems'
import { isLowStock } from '../lib/stockStatus'
import type { CashShift, OrderStatus, StockItem } from '../lib/types'

export interface DashboardSummary {
  pendingOrders: number
  occupiedTables: number
  lowStock: number
  lowStockItems: StockItem[]
  currentShift: CashShift | null
}

const EMPTY_SUMMARY: DashboardSummary = {
  pendingOrders: 0,
  occupiedTables: 0,
  lowStock: 0,
  lowStockItems: [],
  currentShift: null,
}

const REFRESH_MS = 30_000
const ACTIVE_STATUSES: OrderStatus[] = ['pending', 'accepted', 'ready']

/**
 * M32 RF-06 — numbers for the sidebar badges, the top bar and the stock toast.
 * Each source is fetched independently: a failing request leaves its previous
 * value untouched (zero on first load) and never throws into the layout.
 */
export function useDashboardSummary(
  restaurantId: string | null,
  ordersEnabled = true,
): DashboardSummary {
  const [summary, setSummary] = useState<DashboardSummary>(EMPTY_SUMMARY)

  useEffect(() => {
    if (restaurantId === null) {
      setSummary(EMPTY_SUMMARY)
      return
    }
    const id = restaurantId
    let cancelled = false

    async function refresh(): Promise<void> {
      const [ordersResult, shiftResult, stockResult] = await Promise.allSettled([
        ordersEnabled
          ? Promise.all(ACTIVE_STATUSES.map((status) => listOrders(id, status)))
          : Promise.resolve(null),
        getCurrentShift(id),
        listStockItems(id),
      ])
      if (cancelled) return

      setSummary((prev) => {
        const next = { ...prev }
        if (ordersResult.status === 'fulfilled') {
          const lists = ordersResult.value
          if (lists === null) {
            next.pendingOrders = 0
            next.occupiedTables = 0
          } else {
            next.pendingOrders = lists[0].length
            next.occupiedTables = new Set(
              lists.flat().flatMap((o) => (o.table_id ? [o.table_id] : [])),
            ).size
          }
        }
        if (shiftResult.status === 'fulfilled') {
          next.currentShift = shiftResult.value
        }
        if (stockResult.status === 'fulfilled') {
          next.lowStockItems = stockResult.value.filter(isLowStock)
          next.lowStock = next.lowStockItems.length
        }
        return next
      })
    }

    void refresh()
    const timer = setInterval(() => void refresh(), REFRESH_MS)
    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [restaurantId, ordersEnabled])

  return summary
}
