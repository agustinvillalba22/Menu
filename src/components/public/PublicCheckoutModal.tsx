import React, { useState } from 'react'
import { X, CheckCircle2, Loader2, AlertTriangle, MessageCircle } from 'lucide-react'
import { ApiError } from '../../lib/api'
import { createOrder } from '../../lib/orders'
import { addOrderToken } from '../../lib/orderTokens'
import type { CartLine } from './cart'
import type { OrderCreatePayload, OrderRead, OrderType, PaymentMethod, Table } from '../../lib/types'

interface PublicCheckoutModalProps {
  qrToken: string
  lines: CartLine[]
  total: number
  // The restaurant's configured tables. When non-empty and order_type
  // is 'mesa', the table field becomes a <select> of real tables instead of
  // free text. Empty array (restaurant hasn't adopted the feature) keeps
  // today's free-text input unchanged.
  tables: Table[]
  // Id of the table preselected via the table QR (?mesa=N), if any.
  // When it matches a table, it is locked: fixed 'mesa', no type/table change.
  initialTableId?: string
  // When true the guest can choose between paying at the local and paying
  // with Mercado Pago. Absent/false → no selector, payload unchanged.
  acceptsMercadoPago?: boolean
  onClose: () => void
  onSuccess: () => void
}

type Phase =
  | { status: 'form' }
  | { status: 'submitting' }
  | { status: 'redirecting' }
  | { status: 'error'; message: string }
  | { status: 'done'; order: OrderRead }

const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Pagar en el local' },
  { value: 'mercadopago', label: 'Pagar con Mercado Pago' },
]

const ORDER_TYPES: { value: OrderType; label: string }[] = [
  { value: 'mesa', label: 'En mesa' },
  { value: 'llevar', label: 'Para llevar' },
  { value: 'envio', label: 'Envío' },
]

function errorMessage(err: unknown): string {
  if (err instanceof ApiError) {
    if (err.code === 'orders_disabled') return 'El local dejó de aceptar pedidos.'
    if (err.code === 'item_not_found' || err.code === 'modifier_not_found') {
      return 'Algún producto de tu pedido ya no está disponible. Revisá tu carrito.'
    }
    if (err.code === 'mercadopago_unavailable') {
      return 'Mercado Pago no está disponible en este momento. Elegí pagar en el local.'
    }
    if (err.code === 'payment_provider_error') {
      return 'No pudimos iniciar el pago con Mercado Pago. Intentá de nuevo.'
    }
    if (err.status === 422) return 'Revisá los datos del pedido e intentá de nuevo.'
  }
  return 'No se pudo enviar el pedido. Intentá de nuevo.'
}

/** Checkout form → real order creation → confirmation with the backend order id. */
export default function PublicCheckoutModal({
  qrToken,
  lines,
  total,
  tables,
  initialTableId,
  acceptsMercadoPago = false,
  onClose,
  onSuccess,
}: PublicCheckoutModalProps): React.JSX.Element {
  const [customerName, setCustomerName] = useState('')
  // A table preselected via QR (and present in `tables`) is locked.
  const lockedTable = initialTableId ? tables.find((t) => t.id === initialTableId) ?? null : null
  const [orderType, setOrderType] = useState<OrderType>('mesa')
  const [tableOrAddress, setTableOrAddress] = useState('')
  const [tableId, setTableId] = useState(initialTableId ?? '')
  const [notes, setNotes] = useState('')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash')
  const [phase, setPhase] = useState<Phase>({ status: 'form' })

  const needsLocation = orderType === 'mesa' || orderType === 'envio'
  const locationLabel = orderType === 'mesa' ? 'Número de mesa' : 'Dirección de entrega'
  // Real tables available → the "mesa" field becomes a <select>.
  const useTableSelect = orderType === 'mesa' && tables.length > 0 && lockedTable === null

  const payWithMercadoPago = acceptsMercadoPago && paymentMethod === 'mercadopago'
  const busy = phase.status === 'submitting' || phase.status === 'redirecting'

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault()
    const payload: OrderCreatePayload = {
      customer_name: customerName.trim(),
      order_type: orderType,
      table_or_address: useTableSelect ? null : tableOrAddress.trim() || null,
      table_id: lockedTable ? lockedTable.id : useTableSelect ? tableId || null : null,
      notes: notes.trim() || null,
      items: lines.map((l) => ({
        item_id: l.item.id,
        quantity: l.quantity,
        modifier_ids: l.modifiers.map((m) => m.id),
        special_instructions: l.specialInstructions ?? null,
      })),
    }
    if (payWithMercadoPago) payload.payment_method = 'mercadopago'
    setPhase({ status: 'submitting' })
    try {
      const order = await createOrder(qrToken, payload)
      // Remember the guest's own order (locked table only).
      if (lockedTable && order.public_token) addOrderToken(qrToken, lockedTable.number, order.public_token)
      if (payWithMercadoPago) {
        // The cart stays intact until the payment is confirmed on return.
        if (!order.payment_url) {
          setPhase({ status: 'error', message: errorMessage(null) })
          return
        }
        setPhase({ status: 'redirecting' })
        window.location.assign(order.payment_url)
        return
      }
      onSuccess()
      setPhase({ status: 'done', order })
    } catch (err) {
      setPhase({ status: 'error', message: errorMessage(err) })
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Finalizar pedido"
      data-testid="checkout-modal"
    >
      <div className="fixed inset-0 cursor-pointer" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border-t-4 border-primario bg-white shadow-2xl sm:max-w-md sm:rounded-[32px]">
        <div className="flex items-center justify-between border-b border-gray-150 p-4">
          <h2 className="text-lg font-black uppercase text-gray-900">
            {phase.status === 'done' ? 'Pedido confirmado' : 'Finalizar pedido'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-150 text-gray-500 transition-all hover:bg-gray-200 hover:text-gray-900"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {phase.status === 'done' ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center" data-testid="order-confirmation">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <h3 className="text-xl font-black text-gray-900">¡Gracias, {phase.order.customer_name}!</h3>
            <p className="text-sm text-gray-500">Tu pedido fue recibido por el local.</p>
            <div className="mt-2 w-full rounded-2xl border border-gray-150 bg-[#f5f5f0] p-4 text-left">
              <div className="flex justify-between text-sm">
                <span className="font-bold text-gray-500">N° de pedido</span>
                <span className="font-mono font-black text-gray-900" data-testid="order-number">
                  #{phase.order.id.slice(0, 8)}
                </span>
              </div>
              <div className="mt-1 flex justify-between text-sm">
                <span className="font-bold text-gray-500">Total</span>
                <span className="font-mono font-black text-primario">${phase.order.total}</span>
              </div>
            </div>
            {/* "Confirmar por WhatsApp". Only rendered when the server returned a
                `whatsapp_url` (built from the order's snapshots on POST /orders,
                and null when the local has no WhatsApp number). A plain anchor with
                `target=_blank` and `rel=noopener` — no JS window.open — so it
                works on mobile where popups are blocked and the wa.me deep link
                hands off to the WhatsApp app via the OS. */}
            {phase.order.whatsapp_url && (
              <a
                href={phase.order.whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-4 text-base font-bold text-white shadow-lg transition-all hover:bg-emerald-700 active:scale-[0.98]"
                data-testid="whatsapp-confirm-button"
              >
                <MessageCircle className="h-5 w-5" aria-hidden="true" />
                Confirmar por WhatsApp
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="mt-3 w-full rounded-2xl bg-primario py-4 text-base font-bold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.98]"
            >
              Listo
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4 overflow-y-auto p-5">
            <div className="space-y-1.5">
              <label htmlFor="customer-name" className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                Tu nombre
              </label>
              <input
                id="customer-name"
                type="text"
                required
                maxLength={120}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="Ej: Juan Pérez"
                className="w-full rounded-2xl border border-gray-150 bg-[#f5f5f0] px-4 py-3 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-primario"
              />
            </div>

            {!lockedTable && (
            <fieldset className="space-y-1.5">
              <legend className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                Tipo de pedido
              </legend>
              <div className="flex gap-2">
                {ORDER_TYPES.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    aria-pressed={orderType === opt.value}
                    onClick={() => setOrderType(opt.value)}
                    className={`flex-1 rounded-xl border px-2 py-2.5 text-xs font-black transition-all ${
                      orderType === opt.value
                        ? 'border-primario bg-secundario text-primario'
                        : 'border-gray-200 bg-white text-gray-500 hover:text-gray-800'
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </fieldset>
            )}

            {acceptsMercadoPago && (
              <fieldset className="space-y-1.5">
                <legend className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                  Método de pago
                </legend>
                <div className="flex gap-2">
                  {PAYMENT_METHODS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      aria-pressed={paymentMethod === opt.value}
                      onClick={() => setPaymentMethod(opt.value)}
                      className={`flex-1 rounded-xl border px-2 py-2.5 text-xs font-black transition-all ${
                        paymentMethod === opt.value
                          ? 'border-primario bg-secundario text-primario'
                          : 'border-gray-200 bg-white text-gray-500 hover:text-gray-800'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </fieldset>
            )}

            {lockedTable && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                  Tu mesa
                </span>
                <p
                  data-testid="locked-table"
                  className="w-full rounded-2xl border border-gray-150 bg-[#f5f5f0] px-4 py-3 text-sm font-bold text-gray-900"
                >
                  Mesa {lockedTable.number}
                </p>
              </div>
            )}

            {needsLocation && useTableSelect && (
              <div className="space-y-1.5">
                <label htmlFor="table-select" className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                  {locationLabel}
                </label>
                <select
                  id="table-select"
                  required
                  value={tableId}
                  onChange={(e) => setTableId(e.target.value)}
                  className="w-full rounded-2xl border border-gray-150 bg-[#f5f5f0] px-4 py-3 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-primario"
                >
                  <option value="" disabled>
                    Elegí tu mesa
                  </option>
                  {tables.map((t) => (
                    <option key={t.id} value={t.id}>
                      Mesa {t.number}
                      {t.capacity !== null ? ` (hasta ${t.capacity})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {needsLocation && !useTableSelect && !lockedTable && (
              <div className="space-y-1.5">
                <label htmlFor="table-or-address" className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                  {locationLabel}
                </label>
                <input
                  id="table-or-address"
                  type="text"
                  required
                  maxLength={200}
                  value={tableOrAddress}
                  onChange={(e) => setTableOrAddress(e.target.value)}
                  placeholder={orderType === 'mesa' ? 'Ej: Mesa 4' : 'Ej: Av. Siempre Viva 123'}
                  className="w-full rounded-2xl border border-gray-150 bg-[#f5f5f0] px-4 py-3 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-primario"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label htmlFor="order-notes" className="text-[11px] font-black uppercase tracking-widest text-gray-400">
                Notas (opcional)
              </label>
              <textarea
                id="order-notes"
                rows={2}
                maxLength={500}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Aclaraciones para el local…"
                className="w-full rounded-2xl border border-gray-150 bg-[#f5f5f0] px-4 py-3 text-sm transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-primario"
              />
            </div>

            {phase.status === 'error' && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600"
              >
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{phase.message}</span>
              </div>
            )}

            <button
              type="submit"
              id="btn-submit-order"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primario py-4 text-base font-bold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
            >
              {busy ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  <span>{phase.status === 'redirecting' ? 'Redirigiendo a Mercado Pago…' : 'Enviando…'}</span>
                </>
              ) : (
                <span>Confirmar pedido • ${total.toFixed(2)}</span>
              )}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
