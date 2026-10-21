import React, { useCallback, useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { CheckCircle2, CreditCard, TriangleAlert } from 'lucide-react'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import {
  connectMercadoPago,
  disconnectMercadoPago,
  getMercadoPagoStatus,
} from '../../lib/payments'
import type { MercadoPagoStatus } from '../../lib/types'

const primaryBtn =
  'rounded-lg bg-neutral-900 px-4 py-2 text-xs font-medium text-white shadow-xs transition-colors hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-300'
const secondaryBtn =
  'rounded-lg border border-neutral-300 px-4 py-2 text-xs font-medium text-neutral-700 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800'
const dangerBtn =
  'rounded-lg border border-red-300 px-4 py-2 text-xs font-medium text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/40'

type Flash = { kind: 'success' | 'error'; text: string }

const FLASH_STYLE: Record<Flash['kind'], string> = {
  success:
    'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300',
  error:
    'border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-400',
}

function flashFromParam(value: string | null): Flash | null {
  if (value === 'connected') {
    return { kind: 'success', text: 'Cuenta de Mercado Pago conectada correctamente.' }
  }
  if (value === 'error') {
    return { kind: 'error', text: 'No se pudo conectar tu cuenta de Mercado Pago. Intentá de nuevo.' }
  }
  return null
}

function Card({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="rounded-xl border border-neutral-200/90 bg-white p-6 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900">
      {children}
    </div>
  )
}

export default function PaymentsPage(): React.JSX.Element {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useMyRestaurant()
  const restaurantId = restaurant?.id ?? null
  const isOwner = restaurant?.role === 'owner'

  const [searchParams, setSearchParams] = useSearchParams()
  // The ?mp= result is read once and then removed from the URL so a refresh
  // does not replay the message.
  const [flash, setFlash] = useState<Flash | null>(() => flashFromParam(searchParams.get('mp')))

  const [status, setStatus] = useState<MercadoPagoStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.has('mp')) {
      const next = new URLSearchParams(searchParams)
      next.delete('mp')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams])

  useEffect(() => {
    if (restaurantId === null) {
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setLoadError(null)
    getMercadoPagoStatus(restaurantId)
      .then((s) => {
        if (!cancelled) setStatus(s)
      })
      .catch(() => {
        if (!cancelled) setLoadError('No se pudo cargar el estado de Mercado Pago.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  const handleConnect = useCallback(async (): Promise<void> => {
    if (restaurantId === null) return
    setBusy(true)
    setActionError(null)
    try {
      const url = await connectMercadoPago(restaurantId)
      window.location.assign(url)
    } catch {
      setActionError('No se pudo iniciar la conexión con Mercado Pago. Intentá de nuevo.')
      setBusy(false)
    }
  }, [restaurantId])

  async function handleDisconnect(): Promise<void> {
    if (restaurantId === null) return
    setBusy(true)
    setActionError(null)
    try {
      await disconnectMercadoPago(restaurantId)
      setStatus((prev) =>
        prev ? { ...prev, connected: false, status: null, mp_user_id: null } : prev,
      )
      setConfirming(false)
    } catch {
      setActionError('No se pudo desconectar la cuenta. Intentá de nuevo.')
    } finally {
      setBusy(false)
    }
  }

  if (restaurantLoading || loading) {
    return <p className="text-sm text-neutral-600 dark:text-neutral-300">Cargando…</p>
  }
  if (restaurantError) {
    return (
      <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
        {restaurantError}
      </div>
    )
  }
  if (!restaurant) {
    return (
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        Creá tu restaurante primero desde “Mi restaurante”.
      </p>
    )
  }

  const isConnected = status?.connected === true && status.status === 'connected'
  const needsReconnect = status?.status === 'disconnected'

  return (
    <div className="max-w-2xl space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Pasarela de pagos</h1>
        <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
          Cobrá los pedidos del menú digital con Mercado Pago. El dinero va directo a tu cuenta.
        </p>
      </div>

      {flash && (
        <div role="status" className={`rounded-lg border px-3 py-2 text-sm ${FLASH_STYLE[flash.kind]}`}>
          <div className="flex items-start justify-between gap-3">
            <span>{flash.text}</span>
            <button
              type="button"
              onClick={() => setFlash(null)}
              aria-label="Cerrar aviso"
              className="text-xs underline"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}

      {(loadError || actionError) && (
        <div role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-400">
          {loadError ?? actionError}
        </div>
      )}

      {status && (
        <Card>
          <div className="flex items-start gap-3">
            <CreditCard className="mt-0.5 h-5 w-5 shrink-0 text-neutral-400 dark:text-neutral-500" aria-hidden="true" />
            <div className="min-w-0 flex-1 space-y-3">
              <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">Mercado Pago</h2>

              {!status.configured && (
                <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                  La integración con Mercado Pago no está configurada en el servidor.
                </p>
              )}

              {status.configured && isConnected && (
                <>
                  <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                    <span>Cuenta conectada</span>
                  </p>
                  {status.mp_user_id && (
                    <p className="font-mono text-xs text-neutral-500 dark:text-neutral-400">
                      ID de usuario: {status.mp_user_id}
                    </p>
                  )}
                  {isOwner &&
                    (confirming ? (
                      <div className="space-y-2 rounded-lg border border-red-200 bg-red-50/60 p-3 dark:border-red-900/60 dark:bg-red-950/20">
                        <p className="text-sm text-neutral-800 dark:text-neutral-200">
                          ¿Desconectar tu cuenta? Los clientes dejarán de ver la opción de pagar con Mercado Pago.
                        </p>
                        <div className="flex gap-2">
                          <button type="button" disabled={busy} onClick={handleDisconnect} className={dangerBtn}>
                            Sí, desconectar
                          </button>
                          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className={secondaryBtn}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setConfirming(true)} className={secondaryBtn}>
                        Desconectar
                      </button>
                    ))}
                </>
              )}

              {status.configured && !isConnected && (
                <>
                  {needsReconnect ? (
                    <p className="flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      Reconectá tu cuenta: la conexión con Mercado Pago venció y no se pueden cobrar pedidos.
                    </p>
                  ) : (
                    <p className="text-sm text-neutral-600 dark:text-neutral-300">
                      Todavía no conectaste una cuenta de Mercado Pago.
                    </p>
                  )}
                  {isOwner ? (
                    <button type="button" disabled={busy} onClick={handleConnect} className={primaryBtn}>
                      Conectar con Mercado Pago
                    </button>
                  ) : (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Solo el administrador puede conectar la cuenta.
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}
