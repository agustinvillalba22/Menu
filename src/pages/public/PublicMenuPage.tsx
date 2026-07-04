import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { ApiError } from '../../lib/api'
import { getPublicMenu } from '../../lib/publicMenu'
import type { PublicItem, PublicMenuResponse, Style } from '../../lib/types'

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

function renderItem(item: PublicItem): React.JSX.Element {
  return (
    <li key={item.id} className="flex flex-col gap-1 border-b border-gray-100 py-3">
      <div className="flex items-baseline justify-between gap-4">
        <span className="font-medium text-gray-900">{item.name}</span>
        <span className="shrink-0 text-primario font-semibold">
          ${parseFloat(item.price).toFixed(2)}
        </span>
      </div>
      {item.description && <p className="text-sm text-gray-600">{item.description}</p>}
      {item.tags.length > 0 && (
        <ul className="flex flex-wrap gap-1.5">
          {item.tags.map((tag) => (
            <li
              key={tag.id}
              className="bg-secundario rounded-full px-2 py-0.5 text-xs text-gray-700"
            >
              {tag.name}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export default function PublicMenuPage(): React.JSX.Element {
  const { qrToken } = useParams<{ qrToken: string }>()
  const [state, setState] = useState<LoadState>({ status: 'loading' })

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

  const { restaurant, style, categories } = state.data

  return (
    <div
      style={themeStyle(style)}
      className="min-h-screen bg-white px-4 py-10 font-sans text-gray-900"
    >
      <div className="mx-auto max-w-2xl">
        <header className="mb-8 border-b-2 border-primario pb-4">
          <h1 className="font-headings text-3xl font-bold text-primario">{restaurant.name}</h1>
        </header>

        {categories.length === 0 && (
          <p className="text-sm text-gray-600">Este menú todavía no tiene productos.</p>
        )}

        {categories.map((category) => (
          <section key={category.id} className="mb-10">
            <h2 className="font-headings mb-4 text-2xl font-semibold">{category.name}</h2>
            {category.subcategories.map((sub) => (
              <div key={sub.id} className="mb-6">
                <h3 className="mb-2 text-lg font-medium text-gray-700">{sub.name}</h3>
                <ul>{sub.items.map(renderItem)}</ul>
              </div>
            ))}
          </section>
        ))}
      </div>
    </div>
  )
}
