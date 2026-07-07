import React, { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Search, ShoppingBag, ChevronRight } from 'lucide-react'
import { ApiError } from '../../lib/api'
import { getPublicMenu } from '../../lib/publicMenu'
import type { PublicCategory, PublicItem, PublicMenuResponse, Style } from '../../lib/types'
import { usePublicCart } from '../../components/public/cart'
import PublicProductCard from '../../components/public/PublicProductCard'
import PublicItemModal from '../../components/public/PublicItemModal'
import PublicCartDrawer from '../../components/public/PublicCartDrawer'
import PublicCheckoutModal from '../../components/public/PublicCheckoutModal'

type LoadState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'error' }
  | { status: 'ready'; data: PublicMenuResponse }

/**
 * Builds the local theming style object from the restaurant style.
 * Sets CSS vars ONLY on the returned object (applied to a local wrapper),
 * never on document.documentElement, so the theme cannot leak to other routes.
 */
function themeStyle(style: Style | null): React.CSSProperties {
  const vars: Record<string, string> = {}
  if (style) {
    if (style.primary_color) vars['--color-primario'] = style.primary_color
    if (style.secondary_color) vars['--color-secundario'] = style.secondary_color
    vars['--font-heading'] = style.font_family
  }
  return vars as React.CSSProperties
}

function matchesSearch(item: PublicItem, query: string): boolean {
  if (!query) return true
  const q = query.toLowerCase()
  return (
    item.name.toLowerCase().includes(q) ||
    item.description.toLowerCase().includes(q) ||
    item.tags.some((t) => t.name.toLowerCase().includes(q))
  )
}

export default function PublicMenuPage(): React.JSX.Element {
  const { qrToken } = useParams<{ qrToken: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [selectedItem, setSelectedItem] = useState<PublicItem | null>(null)
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutOpen, setCheckoutOpen] = useState(false)

  const cart = usePublicCart(qrToken)

  useEffect(() => {
    if (qrToken === undefined) {
      setState({ status: 'not_found' })
      return
    }
    let cancelled = false
    setState({ status: 'loading' })

    async function load(token: string): Promise<void> {
      try {
        const data = await getPublicMenu(token)
        if (!cancelled) setState({ status: 'ready', data })
      } catch (err) {
        if (cancelled) return
        if (err instanceof ApiError && err.status === 404) {
          setState({ status: 'not_found' })
        } else {
          setState({ status: 'error' })
        }
      }
    }

    void load(qrToken)
    return () => {
      cancelled = true
    }
  }, [qrToken])

  const categories: PublicCategory[] = state.status === 'ready' ? state.data.categories : []
  const visibleCategories = useMemo(
    () =>
      categories
        .filter((c) => selectedCategory === 'all' || c.id === selectedCategory)
        .map((c) => ({
          ...c,
          subcategories: c.subcategories
            .map((s) => ({ ...s, items: s.items.filter((i) => matchesSearch(i, search)) }))
            .filter((s) => s.items.length > 0),
        }))
        .filter((c) => c.subcategories.length > 0),
    [categories, selectedCategory, search],
  )

  if (state.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white text-gray-600">
        Cargando menú…
      </div>
    )
  }

  if (state.status === 'not_found') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-2 bg-white px-4 text-center">
        <h1 className="text-2xl font-semibold text-gray-900">Menú no encontrado</h1>
        <p className="text-sm text-gray-600">
          El código que escaneaste no corresponde a ningún menú.
        </p>
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4 text-center text-gray-600">
        No se pudo cargar el menú. Intentá de nuevo más tarde.
      </div>
    )
  }

  const { restaurant, style } = state.data
  const orderingEnabled = restaurant.orders_enabled === true

  return (
    <div style={themeStyle(style)} className="min-h-screen bg-[#faf6f0] font-sans text-gray-900">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col border-x border-gray-200 bg-white pb-24">
        {/* Header */}
        <header className="rounded-b-[40px] bg-primario p-6 pb-8 text-white shadow-md">
          <div className="mb-6 flex items-center justify-between">
            <h1 className="font-headings text-3xl font-bold uppercase leading-none tracking-tight text-white">
              {restaurant.name}
            </h1>
            {orderingEnabled && (
              <button
                type="button"
                id="btn-header-cart"
                aria-label="Ver carrito"
                onClick={() => setCartOpen(true)}
                className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-md transition-all active:scale-95"
              >
                <ShoppingBag className="h-5 w-5 stroke-[2.5] text-primario" />
                {cart.count > 0 && (
                  <span
                    data-testid="cart-count-badge"
                    className="pointer-events-none absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-[9px] font-black text-white ring-2 ring-white"
                  >
                    {cart.count}
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="relative w-full">
            <input
              id="search-input"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar producto"
              aria-label="Buscar producto"
              className="block w-full rounded-full border border-transparent bg-white py-3 pl-5 pr-12 text-sm text-gray-800 placeholder-gray-400 shadow-md focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-4.5">
              <Search className="h-5 w-5 stroke-[2.5] text-gray-400" />
            </div>
          </div>
        </header>

        {/* Category filter */}
        <nav
          aria-label="Categorías"
          className="sticky top-0 z-20 border-b border-gray-200/40 bg-[#fcf8f5]/90 px-4 py-3 backdrop-blur-md"
        >
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            <FilterChip
              label="Todo"
              active={selectedCategory === 'all'}
              onClick={() => setSelectedCategory('all')}
            />
            {categories.map((c) => (
              <React.Fragment key={c.id}>
                <FilterChip
                  label={c.name}
                  active={selectedCategory === c.id}
                  onClick={() => setSelectedCategory(c.id)}
                />
              </React.Fragment>
            ))}
          </div>
        </nav>

        {/* Menu body */}
        <main className="flex-1 space-y-8 px-4 py-6">
          {categories.length === 0 && (
            <p className="text-sm text-gray-600">Este menú todavía no tiene productos.</p>
          )}
          {categories.length > 0 && visibleCategories.length === 0 && (
            <p className="py-8 text-center text-sm text-gray-500">
              No encontramos productos para tu búsqueda.
            </p>
          )}

          {visibleCategories.map((category) => (
            <section key={category.id} className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-5 w-1.5 rounded-full bg-primario" />
                <h2 className="font-headings text-lg font-black uppercase tracking-tight text-gray-900">
                  {category.name}
                </h2>
              </div>
              {category.subcategories.map((sub) => (
                <div key={sub.id} className="space-y-3">
                  <h3 className="text-sm font-medium text-gray-500">{sub.name}</h3>
                  <div className="grid grid-cols-1 gap-4">
                    {sub.items.map((item) => (
                      <React.Fragment key={item.id}>
                        <PublicProductCard
                          item={item}
                          orderingEnabled={orderingEnabled}
                          onSelect={setSelectedItem}
                        />
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </section>
          ))}
        </main>
      </div>

      {/* Floating cart button */}
      {orderingEnabled && cart.count > 0 && (
        <div className="fixed bottom-5 left-1/2 z-30 w-full max-w-xs -translate-x-1/2 px-3">
          <button
            type="button"
            id="btn-floating-cart"
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between rounded-2xl bg-primario px-6 py-4 text-white shadow-xl transition-all hover:opacity-95 active:scale-[0.98]"
          >
            <span className="flex items-center gap-2.5">
              <span className="relative">
                <ShoppingBag className="h-5 w-5 text-white" />
                <span className="absolute -right-2.5 -top-2.5 flex h-5 w-5 items-center justify-center rounded-full border border-primario bg-white text-[10px] font-extrabold text-primario">
                  {cart.count}
                </span>
              </span>
              <span className="text-xs font-bold">Ver carrito</span>
            </span>
            <span className="flex items-center gap-1 font-mono text-sm font-bold">
              <span>${cart.total.toFixed(2)}</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </span>
          </button>
        </div>
      )}

      {/* Item detail modal */}
      <PublicItemModal
        item={selectedItem}
        orderingEnabled={orderingEnabled}
        onClose={() => setSelectedItem(null)}
        onAdd={(item, modifiers, quantity, note) => cart.addLine(item, modifiers, quantity, note)}
      />

      {/* Cart + checkout only make sense when ordering is enabled */}
      {orderingEnabled && (
        <>
          <PublicCartDrawer
            isOpen={cartOpen}
            lines={cart.lines}
            onClose={() => setCartOpen(false)}
            onUpdateQuantity={cart.updateQuantity}
            onRemove={cart.removeLine}
            onCheckout={() => {
              setCartOpen(false)
              setCheckoutOpen(true)
            }}
          />
          {checkoutOpen && qrToken !== undefined && (
            <PublicCheckoutModal
              qrToken={qrToken}
              lines={cart.lines}
              total={cart.total}
              onClose={() => setCheckoutOpen(false)}
              onSuccess={() => cart.clear()}
            />
          )}
        </>
      )}
    </div>
  )
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 whitespace-nowrap rounded-2xl border px-4 py-2 text-[11px] font-black transition-all active:scale-95 ${
        active
          ? 'border-primario bg-secundario text-primario'
          : 'border-gray-200/60 bg-white text-gray-400 hover:text-gray-800'
      }`}
    >
      {label}
    </button>
  )
}
