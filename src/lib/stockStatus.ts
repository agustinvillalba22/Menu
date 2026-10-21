import type { StockItem } from './types'

/** Single source of truth for "low stock" (M19 badge "Bajo", M32 sidebar badge and toast). */
export function isLowStock(item: StockItem): boolean {
  return parseFloat(item.quantity) <= parseFloat(item.min_threshold)
}

export function isCriticalStock(item: StockItem): boolean {
  return parseFloat(item.quantity) <= 0
}
