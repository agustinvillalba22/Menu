import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import { getOrdersStatus, requestBill as requestBillApi } from '../../lib/publicMenu'
import { getOrderTokens, removeOrderTokens } from '../../lib/orderTokens'
import type { PublicOrderStatus } from '../../lib/types'

export const POLL_INTERVAL_MS = 25_000

/** M33/M37 rule: pending|accepted|ready and (cash or payment approved). */
export function isActiveOrder(o: PublicOrderStatus): boolean {
  return (
    (o.status === 'pending' || o.status === 'accepted' || o.status === 'ready') &&
    (o.payment_method === 'cash' || o.payment_status === 'approved')
  )
}

export function billTotal(orders: PublicOrderStatus[]): number {
  return orders.filter(isActiveOrder).reduce((sum, o) => sum + parseFloat(o.total), 0)
}

export type BillMessage = { kind: 'ok' | 'gone' | 'error'; text: string }

export interface TableBill {
  orders: PublicOrderStatus[]
  total: number
  hasActive: boolean
  billRequested: boolean
  requesting: boolean
  message: BillMessage | null
  closedNotice: boolean
  dismissClosedNotice: () => void
  refresh: () => Promise<void>
  requestBill: () => Promise<void>
}

/**
 * M37: the guest's own orders for the locked table, polled every 25 s while
 * the tab is visible. `mesa === null` (or `enabled` false) keeps it inert.
 */
export function useTableBill(qrToken: string | undefined, mesa: number | null, enabled: boolean): TableBill {
  const [orders, setOrders] = useState<PublicOrderStatus[]>([])
  const [closedNotice, setClosedNotice] = useState(false)
  const [requestedLocal, setRequestedLocal] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [message, setMessage] = useState<BillMessage | null>(null)
  const inFlight = useRef(false)
  const alive = useRef(true)
  const active = enabled && qrToken !== undefined && mesa !== null

  const refresh = useCallback(async (): Promise<void> => {
    if (!active || inFlight.current) return
    const tokens = getOrderTokens(qrToken, mesa)
    if (tokens.length === 0) {
      setOrders([])
      setRequestedLocal(false)
      return
    }
    inFlight.current = true
    try {
      const list = await getOrdersStatus(qrToken, tokens)
      if (!alive.current) return
      const returned = new Set(list.map((o) => o.token))
      const missing = tokens.filter((t) => !returned.has(t))
      if (list.length > 0 && list.every((o) => o.status === 'completed')) {
        removeOrderTokens(qrToken, tokens)
        setOrders([])
        setRequestedLocal(false)
        setClosedNotice(true)
        return
      }
      const done = list.filter((o) => o.status === 'completed').map((o) => o.token)
      if (missing.length + done.length > 0) removeOrderTokens(qrToken, [...missing, ...done])
      const remaining = list.filter((o) => o.status !== 'completed')
      setOrders(remaining)
      if (!remaining.some((o) => isActiveOrder(o) && o.bill_requested)) setRequestedLocal(false)
    } catch {
      // Network error: keep the last state and retry on the next cycle.
    } finally {
      inFlight.current = false
    }
  }, [active, qrToken, mesa])

  useEffect(() => {
    alive.current = true
    if (!active) {
      setOrders([])
      setRequestedLocal(false)
      return () => {
        alive.current = false
      }
    }
    void refresh()
    const id = setInterval(() => {
      if (document.visibilityState !== 'hidden') void refresh()
    }, POLL_INTERVAL_MS)
    const onVisible = (): void => {
      if (document.visibilityState === 'visible') void refresh()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      alive.current = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [active, refresh])

  const activeOrders = orders.filter(isActiveOrder)
  const hasActive = activeOrders.length > 0
  const billRequested = hasActive && (requestedLocal || activeOrders.some((o) => o.bill_requested))

  const requestBill = useCallback(async (): Promise<void> => {
    if (!active || requesting) return
    const latest = [...orders.filter(isActiveOrder)].sort((a, b) => a.created_at.localeCompare(b.created_at)).pop()
    if (!latest) return
    setRequesting(true)
    setMessage(null)
    try {
      await requestBillApi(qrToken, latest.token)
      if (!alive.current) return
      setRequestedLocal(true)
      setMessage({ kind: 'ok', text: 'Ya avisamos al mozo' })
    } catch (err) {
      if (!alive.current) return
      if (err instanceof ApiError && err.status === 409) {
        setMessage({ kind: 'gone', text: 'Tu mesa ya no tiene pedidos activos' })
        await refresh()
      } else {
        setMessage({ kind: 'error', text: 'No pudimos avisar al mozo. Intentá de nuevo.' })
      }
    } finally {
      if (alive.current) setRequesting(false)
    }
  }, [active, requesting, orders, qrToken, refresh])

  return {
    orders,
    total: billTotal(orders),
    hasActive,
    billRequested,
    requesting,
    message,
    closedNotice,
    dismissClosedNotice: () => setClosedNotice(false),
    refresh,
    requestBill,
  }
}
