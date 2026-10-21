// M37: per-device storage of the public tokens of the guest's own orders.
// Every storage access is guarded: if storage is unavailable the feature
// degrades to "no bill" without breaking the menu or the checkout.

const ORDER_TOKEN_TTL_MS = 12 * 60 * 60 * 1000
const MAX_ORDER_TOKENS = 20

interface StoredOrder {
  token: string
  createdAt: number
}
interface StoredValue {
  mesa: number
  orders: StoredOrder[]
}

const storageKey = (qrToken: string): string => `menu_orders_${qrToken}`

function isStoredOrder(v: unknown): v is StoredOrder {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.token === 'string' && typeof o.createdAt === 'number'
}

function read(qrToken: string, mesa: number): StoredOrder[] {
  try {
    const raw = localStorage.getItem(storageKey(qrToken))
    if (raw === null) return []
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return []
    const value = parsed as Partial<StoredValue>
    if (value.mesa !== mesa || !Array.isArray(value.orders)) return []
    const now = Date.now()
    return value.orders.filter((o) => isStoredOrder(o) && now - o.createdAt < ORDER_TOKEN_TTL_MS)
  } catch {
    return []
  }
}

function write(qrToken: string, mesa: number, orders: StoredOrder[]): void {
  try {
    if (orders.length === 0) {
      localStorage.removeItem(storageKey(qrToken))
      return
    }
    localStorage.setItem(storageKey(qrToken), JSON.stringify({ mesa, orders }))
  } catch {
    // Storage unavailable: the feature just stays off.
  }
}

/** Valid (non-expired) tokens for this menu and table, oldest first. */
export function getOrderTokens(qrToken: string, mesa: number): string[] {
  return read(qrToken, mesa).map((o) => o.token)
}

export function addOrderToken(qrToken: string, mesa: number, token: string): void {
  const orders = read(qrToken, mesa).filter((o) => o.token !== token)
  orders.push({ token, createdAt: Date.now() })
  write(qrToken, mesa, orders.slice(-MAX_ORDER_TOKENS))
}

export function removeOrderTokens(qrToken: string, tokens: string[]): void {
  try {
    const raw = localStorage.getItem(storageKey(qrToken))
    if (raw === null) return
    const parsed = JSON.parse(raw) as Partial<StoredValue>
    if (typeof parsed.mesa !== 'number' || !Array.isArray(parsed.orders)) {
      localStorage.removeItem(storageKey(qrToken))
      return
    }
    const drop = new Set(tokens)
    write(
      qrToken,
      parsed.mesa,
      parsed.orders.filter((o) => isStoredOrder(o) && !drop.has(o.token)),
    )
  } catch {
    // Corrupt or inaccessible storage: nothing to remove.
  }
}
