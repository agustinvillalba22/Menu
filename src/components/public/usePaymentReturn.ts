import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { getPublicPaymentStatus } from '../../lib/payments'

export const PAYMENT_POLL_INTERVAL_MS = 3000
export const PAYMENT_POLL_MAX_ATTEMPTS = 10

export type PaymentReturnState = 'checking' | 'approved' | 'failed' | 'confirming'

interface UsePaymentReturn {
  state: PaymentReturnState | null
  dismiss: () => void
}

/**
 * M36 (RF-28): handles the return from Mercado Pago (`?pago=ok|error|pendiente
 * &order=<id>`). While the order's payment is still pending it polls the public
 * status endpoint (the webhook can land after the redirect), up to a fixed
 * number of attempts. `onApproved` runs once when the payment is confirmed.
 */
export function usePaymentReturn(
  qrToken: string | undefined,
  onApproved: () => void,
): UsePaymentReturn {
  const [searchParams, setSearchParams] = useSearchParams()
  const pago = searchParams.get('pago')
  const orderId = searchParams.get('order')
  const [state, setState] = useState<PaymentReturnState | null>(null)

  // Latest callback without re-running the polling effect when its identity changes.
  const onApprovedRef = useRef(onApproved)
  useEffect(() => {
    onApprovedRef.current = onApproved
  })

  useEffect(() => {
    if (!pago) {
      setState(null)
      return
    }
    if (pago === 'error') {
      setState('failed')
      return
    }
    if (qrToken === undefined || !orderId) {
      setState('confirming')
      return
    }

    let cancelled = false
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    setState('checking')

    async function tick(token: string, id: string): Promise<void> {
      attempts += 1
      let paymentStatus: string | null = null
      try {
        paymentStatus = (await getPublicPaymentStatus(token, id)).payment_status
      } catch {
        // A transient failure counts as an attempt and is retried.
      }
      if (cancelled) return
      if (paymentStatus === 'approved') {
        setState('approved')
        onApprovedRef.current()
        return
      }
      if (paymentStatus === 'rejected' || paymentStatus === 'cancelled') {
        setState('failed')
        return
      }
      if (attempts >= PAYMENT_POLL_MAX_ATTEMPTS) {
        setState('confirming')
        return
      }
      timer = setTimeout(() => void tick(token, id), PAYMENT_POLL_INTERVAL_MS)
    }

    void tick(qrToken, orderId)
    return () => {
      cancelled = true
      if (timer !== undefined) clearTimeout(timer)
    }
  }, [qrToken, pago, orderId])

  const dismiss = useCallback((): void => {
    const next = new URLSearchParams(searchParams)
    next.delete('pago')
    next.delete('order')
    setSearchParams(next, { replace: true })
  }, [searchParams, setSearchParams])

  return { state, dismiss }
}
