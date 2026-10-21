import React from 'react'
import { X, Loader2 } from 'lucide-react'
import type { PublicOrderStatus } from '../../lib/types'
import type { TableBill } from './useTableBill'
import { isActiveOrder } from './useTableBill'

interface TuConsumoSheetProps {
  bill: TableBill
  onClose: () => void
}

function statusText(o: PublicOrderStatus): string {
  if (o.status === 'cancelled') return 'Cancelado'
  if (o.payment_method === 'mercadopago' && o.payment_status !== 'approved') {
    return o.payment_status === 'pending' ? 'Pago pendiente' : 'Pago no aprobado'
  }
  if (o.status === 'pending') return 'Recibido'
  if (o.status === 'accepted') return 'En preparación'
  if (o.status === 'ready') return 'Listo'
  return 'Entregado'
}

function timeText(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

/** Bottom sheet with the guest's own orders, running total and "Pedir cuenta". */
export default function TuConsumoSheet({ bill, onClose }: TuConsumoSheetProps): React.JSX.Element {
  const { orders, total, hasActive, billRequested, requesting, message } = bill
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Tu consumo"
    >
      <div className="fixed inset-0 cursor-pointer" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex max-h-[90vh] w-full flex-col overflow-hidden rounded-t-3xl border-t-4 border-primario bg-white shadow-2xl sm:max-w-md sm:rounded-[32px]">
        <div className="flex items-center justify-between border-b border-gray-150 p-4">
          <h2 className="text-lg font-black uppercase text-gray-900">Tu consumo</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-150 text-gray-500 hover:text-gray-900"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto p-4">
          {orders.map((o) => {
            const cancelled = o.status === 'cancelled'
            return (
              <section
                key={o.token}
                aria-label={`Pedido de las ${timeText(o.created_at)}`}
                className="rounded-2xl border border-gray-150 p-3"
              >
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-gray-500">{timeText(o.created_at)}</span>
                  <span className={isActiveOrder(o) ? 'text-primario' : 'text-gray-500'}>
                    {statusText(o)}
                  </span>
                </div>
                <ul className={`mt-2 space-y-1 text-sm ${cancelled ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                  {o.items.map((it, i) => (
                    <li key={i} className="flex justify-between gap-2">
                      <span>
                        {it.quantity} × {it.name}
                        {it.modifiers.length > 0 && (
                          <span className="block text-xs text-gray-500">{it.modifiers.join(', ')}</span>
                        )}
                      </span>
                      <span className="font-mono">${it.subtotal}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )
          })}

          <div className="flex justify-between text-base font-black text-gray-900">
            <span>Total</span>
            <span className="font-mono text-primario" data-testid="consumo-total">
              ${total.toFixed(2)}
            </span>
          </div>
          <p className="text-xs text-gray-500">Solo muestra los pedidos hechos desde este celular.</p>

          {message !== null && (
            <p
              role={message.kind === 'error' ? 'alert' : 'status'}
              className={`rounded-2xl px-4 py-3 text-xs font-semibold ${
                message.kind === 'error' ? 'border border-red-200 bg-red-50 text-red-600' : 'bg-secundario text-primario'
              }`}
            >
              {message.text}
            </p>
          )}

          <button
            type="button"
            onClick={() => void bill.requestBill()}
            disabled={!hasActive || billRequested || requesting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-primario py-4 text-base font-bold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.98] disabled:opacity-60"
          >
            {requesting && <Loader2 className="h-4.5 w-4.5 animate-spin" aria-hidden="true" />}
            {billRequested ? 'Cuenta pedida' : 'Pedir cuenta'}
          </button>
        </div>
      </div>
    </div>
  )
}
