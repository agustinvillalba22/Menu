import type { StockItem } from './types'

/** Single source of truth for "low stock" (the "Bajo" badge, sidebar badge and toast). */
export function isLowStock(item: StockItem): boolean {
  return parseFloat(item.quantity) <= parseFloat(item.min_threshold)
}

export function isCriticalStock(item: StockItem): boolean {
  return parseFloat(item.quantity) <= 0
}
