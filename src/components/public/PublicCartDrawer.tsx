import React from 'react'
import { X, Trash2, Plus, Minus, Send, ShoppingBag, ImageOff } from 'lucide-react'
import type { CartLine } from './cart'
import { cartTotal, lineTotal, lineUnitPrice } from './cart'

interface PublicCartDrawerProps {
  isOpen: boolean
  lines: CartLine[]
  onClose: () => void
  onUpdateQuantity: (lineId: string, delta: number) => void
  onRemove: (lineId: string) => void
  onCheckout: () => void
}

/** Sliding cart panel bound to the real per-restaurant cart lines. */
export default function PublicCartDrawer({
  isOpen,
  lines,
  onClose,
  onUpdateQuantity,
  onRemove,
  onCheckout,
}: PublicCartDrawerProps): React.JSX.Element | null {
  if (!isOpen) return null

  const total = cartTotal(lines)
  const count = lines.reduce((sum, l) => sum + l.quantity, 0)

  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label="Mi pedido">
      <div className="fixed inset-0 cursor-pointer bg-black/60 backdrop-blur-xs" onClick={onClose} aria-hidden="true" />

      <div className="relative z-40 flex h-full w-full max-w-md flex-col border-l border-gray-200 bg-[#f5f5f0] shadow-2xl">
        <div className="relative">
          <div className="h-2 w-full bg-primario opacity-90" />
          <div className="flex items-center justify-between border-b border-gray-200 bg-white p-4">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secundario text-primario">
                <ShoppingBag className="h-4.5 w-4.5 text-primario" />
              </div>
              <div>
                <h3 className="text-lg font-black uppercase leading-none text-gray-900">Mi pedido</h3>
                <span className="font-mono text-[10px] uppercase tracking-wider text-gray-400">
                  {count} {count === 1 ? 'producto' : 'productos'}
                </span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Cerrar carrito"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-150 text-gray-500 transition-all hover:bg-gray-200 hover:text-gray-900"
            >
              <X className="h-4.5 w-4.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-4">
          {lines.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center p-8 text-center">
              <span className="mb-3 text-5xl">🛒</span>
              <h4 className="text-lg font-black uppercase text-gray-850">Tu carrito está vacío</h4>
              <p className="mt-1.5 max-w-xs text-xs leading-relaxed text-gray-400">
                Agregá productos del menú para armar tu pedido.
              </p>
            </div>
          ) : (
            lines.map((line) => (
              <div
                key={line.lineId}
                data-testid={`cart-line-${line.lineId}`}
                className="space-y-3.5 rounded-3xl border border-gray-150 bg-white p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-gray-100 bg-gray-50">
                    {line.item.image_url ? (
                      <img
                        src={line.item.image_url}
                        alt={line.item.name}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <ImageOff className="h-5 w-5" />
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="truncate text-[15px] font-black leading-tight text-gray-900">
                        {line.item.name}
                      </h4>
                      <span className="text-sm font-black text-primario">
                        ${lineTotal(line).toFixed(2)}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                      Unitario: ${lineUnitPrice(line).toFixed(2)}
                    </p>
                  </div>
                </div>

                {(line.modifiers.length > 0 || line.specialInstructions) && (
                  <div className="space-y-1.5 rounded-2xl border border-gray-200 bg-[#f5f5f0]/80 p-3 text-[11px]">
                    {line.modifiers.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {line.modifiers.map((m) => (
                          <span
                            key={m.id}
                            className="inline-flex rounded border border-primario/10 bg-secundario px-1.5 py-0.5 font-black text-primario"
                          >
                            {m.name}
                          </span>
                        ))}
                      </div>
                    )}
                    {line.specialInstructions && (
                      <div className="italic text-gray-600">
                        <span className="font-bold not-italic">✍️ Nota: </span>
                        &quot;{line.specialInstructions}&quot;
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-dashed border-gray-150 pt-2.5">
                  <div className="flex items-center rounded-lg border border-gray-200/60 bg-gray-100 p-0.5">
                    <button
                      type="button"
                      aria-label="Quitar una unidad"
                      onClick={() => onUpdateQuantity(line.lineId, -1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-all hover:bg-white hover:text-primario"
                    >
                      <Minus className="h-3.5 w-3.5" />
                    </button>
                    <span className="px-3 font-mono text-xs font-bold text-gray-700">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label="Agregar una unidad"
                      onClick={() => onUpdateQuantity(line.lineId, 1)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-gray-400 transition-all hover:bg-white hover:text-primario"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    aria-label={`Quitar ${line.item.name}`}
                    onClick={() => onRemove(line.lineId)}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-400 transition-all hover:bg-secundario hover:text-primario"
                  >
                    <Trash2 className="h-4.5 w-4.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {lines.length > 0 && (
          <div className="space-y-3.5 border-t border-gray-200 bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between text-sm">
              <span className="font-extrabold text-gray-850">Total</span>
              <span className="font-mono text-2xl font-black text-primario">${total.toFixed(2)}</span>
            </div>
            <button
              type="button"
              id="btn-cart-checkout"
              onClick={onCheckout}
              className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-primario py-4 text-base font-bold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.98]"
            >
              <Send className="h-4.5 w-4.5 shrink-0 fill-white text-primario" />
              <span>Finalizar pedido • ${total.toFixed(2)}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
