import React from 'react'
import { X } from 'lucide-react'
import type { PaymentReturnState } from './usePaymentReturn'

const MESSAGE: Record<PaymentReturnState, string> = {
  checking: 'Confirmando tu pago…',
  approved: '¡Pago recibido! Tu pedido está en preparación.',
  failed: 'El pago no se completó. Podés intentar de nuevo.',
  confirming: 'Estamos confirmando tu pago.',
}

const TONE: Record<PaymentReturnState, string> = {
  checking: 'border-gray-200 bg-white text-gray-700',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  failed: 'border-red-200 bg-red-50 text-red-700',
  confirming: 'border-amber-200 bg-amber-50 text-amber-800',
}

export default function PaymentReturnBanner({
  state,
  onClose,
}: {
  state: PaymentReturnState
  onClose: () => void
}): React.JSX.Element {
  return (
    <div
      role="status"
      className={`mx-4 mt-4 flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-semibold lg:mx-10 ${TONE[state]}`}
    >
      <span>{MESSAGE[state]}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Cerrar aviso"
        className="shrink-0 rounded-full p-0.5 opacity-70 transition-opacity hover:opacity-100"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  )
}
