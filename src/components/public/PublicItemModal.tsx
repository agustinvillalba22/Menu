import React, { useEffect, useState } from 'react'
import { X, Plus, Minus, ShoppingBag, ImageOff } from 'lucide-react'
import type { PublicItem, PublicModifier } from '../../lib/types'
import { badgeEmoji } from './badges'

interface PublicItemModalProps {
  item: PublicItem | null
  orderingEnabled: boolean
  onClose: () => void
  onAdd: (item: PublicItem, modifiers: PublicModifier[], quantity: number, note?: string) => void
}

function modifierLabel(m: PublicModifier): string {
  const value = parseFloat(m.price_delta)
  const sign = value < 0 ? '−' : '+'
  return `${sign}$${Math.abs(value).toFixed(2)}`
}

/**
 * Detail sheet for a public menu item. Shows real modifiers (name/price_delta/
 * type). With ordering enabled it lets the guest pick modifiers, a quantity and
 * a note, then add to cart; otherwise it renders read-only.
 */
export default function PublicItemModal({
  item,
  orderingEnabled,
  onClose,
  onAdd,
}: PublicItemModalProps): React.JSX.Element | null {
  const [quantity, setQuantity] = useState(1)
  const [selected, setSelected] = useState<PublicModifier[]>([])
  const [note, setNote] = useState('')

  useEffect(() => {
    if (item) {
      setQuantity(1)
      setSelected([])
      setNote('')
    }
  }, [item])

  if (!item) return null

  const toggle = (m: PublicModifier): void => {
    setSelected((prev) =>
      prev.some((x) => x.id === m.id) ? prev.filter((x) => x.id !== m.id) : [...prev, m],
    )
  }

  const base = parseFloat(item.price)
  const deltas = selected.reduce((sum, m) => sum + parseFloat(m.price_delta), 0)
  const total = (base + deltas) * quantity

  const handleAdd = (): void => {
    onAdd(item, selected, quantity, note.trim() || undefined)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-0 backdrop-blur-xs sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={item.name}
      data-testid="item-modal"
    >
      <div className="fixed inset-0 cursor-pointer" onClick={onClose} aria-hidden="true" />

      <div className="relative z-10 flex h-[92vh] w-full flex-col overflow-hidden rounded-t-3xl border-t-4 border-primario bg-white shadow-2xl sm:h-[85vh] sm:max-w-md sm:rounded-[32px]">
        <div className="absolute right-4 top-4 z-20">
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white shadow-md backdrop-blur-xs transition-all hover:bg-black/75"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="no-scrollbar flex-1 overflow-y-auto">
          <div className="relative aspect-video w-full bg-gray-100">
            {item.image_url ? (
              <img
                src={item.image_url}
                alt={item.name}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-gray-300">
                <ImageOff className="h-10 w-10" />
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="absolute bottom-4 left-4 right-16">
              <h2 className="text-2xl font-black tracking-tight text-white drop-shadow-md">
                {item.name}
              </h2>
            </div>
          </div>

          <div className="space-y-6 p-5 pb-10">
            <div className="space-y-1">
              {item.description && (
                <p className="text-xs leading-relaxed text-gray-600">{item.description}</p>
              )}
              <div className="flex items-center gap-2 pt-2">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">
                  Precio base:
                </span>
                <span className="text-base font-black text-primario">
                  ${parseFloat(item.price).toFixed(2)}
                </span>
              </div>
              {item.tags.length > 0 && (
                <ul className="flex flex-wrap gap-1.5 pt-2">
                  {item.tags.map((tag) => {
                    const emoji = badgeEmoji(tag)
                    return (
                      <li
                        key={tag.id}
                        className="inline-flex items-center gap-0.5 rounded-full bg-secundario px-2 py-0.5 text-[11px] font-bold text-gray-700"
                      >
                        {emoji && <span aria-hidden="true">{emoji}</span>}
                        <span>{tag.name}</span>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>

            {item.modifiers.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                  Extras y modificadores
                </h3>
                <div className="space-y-2.5">
                  {item.modifiers.map((m) => {
                    const isSelected = selected.some((x) => x.id === m.id)
                    if (!orderingEnabled) {
                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between rounded-2xl border border-gray-150 bg-white p-4"
                        >
                          <span className="text-sm font-bold">{m.name}</span>
                          <span className="font-mono text-xs font-black text-gray-500">
                            {modifierLabel(m)}
                          </span>
                        </div>
                      )
                    }
                    return (
                      <button
                        type="button"
                        key={m.id}
                        id={`modifier-${m.id}`}
                        aria-pressed={isSelected}
                        onClick={() => toggle(m)}
                        className={`flex w-full items-center justify-between rounded-2xl p-4 transition-all duration-200 ${
                          isSelected
                            ? 'border-2 border-primario bg-secundario text-primario'
                            : 'border border-gray-150 bg-white text-gray-800 hover:border-gray-350'
                        }`}
                      >
                        <span className="text-sm font-bold">{m.name}</span>
                        <span
                          className={`font-mono text-xs font-black ${isSelected ? 'text-primario' : 'text-gray-500'}`}
                        >
                          {modifierLabel(m)}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {orderingEnabled && (
              <div className="space-y-2">
                <label
                  htmlFor="item-note"
                  className="block text-[10px] font-black uppercase tracking-widest text-gray-400"
                >
                  ✍️ Instrucciones especiales
                </label>
                <textarea
                  id="item-note"
                  placeholder="Ej: Sin cebolla, cocción a punto…"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                  className="w-full rounded-2xl border border-transparent bg-[#f5f5f0] px-4 py-3 text-xs transition-all focus:bg-white focus:outline-none focus:ring-2 focus:ring-primario"
                />
              </div>
            )}
          </div>
        </div>

        {orderingEnabled && (
          <div className="sticky bottom-0 z-10 flex shrink-0 flex-col gap-3 border-t border-gray-150 bg-white p-4 shadow-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center rounded-xl border border-gray-200/80 bg-gray-150 p-0.5">
                <button
                  type="button"
                  id="btn-decrement"
                  aria-label="Quitar una unidad"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-all hover:bg-white hover:text-primario disabled:opacity-40"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="px-3.5 font-mono text-sm font-bold text-gray-800">{quantity}</span>
                <button
                  type="button"
                  id="btn-increment"
                  aria-label="Agregar una unidad"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-gray-500 transition-all hover:bg-white hover:text-primario"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <div className="text-right">
                <span className="block text-[9px] font-extrabold uppercase tracking-widest text-gray-400">
                  Total
                </span>
                <span className="font-mono text-xl font-black text-primario">
                  ${total.toFixed(2)}
                </span>
              </div>
            </div>

            <button
              type="button"
              id="btn-add-to-cart"
              onClick={handleAdd}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primario py-4 text-base font-bold text-white shadow-lg transition-all hover:opacity-95 active:scale-[0.98]"
            >
              <ShoppingBag className="h-4.5 w-4.5 shrink-0 text-white" />
              <span>Añadir al pedido</span>
              <span className="rounded-full bg-white/20 px-2.5 py-0.5 font-mono text-xs font-bold">
                ${total.toFixed(2)}
              </span>
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
