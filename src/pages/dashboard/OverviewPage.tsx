import React, { useState } from 'react'
import type { FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import { createRestaurant } from '../../lib/restaurants'

export default function OverviewPage(): React.JSX.Element {
  const { restaurant, loading, error, reload } = useMyRestaurant()

  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  async function handleCreate(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setFormError(null)
    setSubmitting(true)
    try {
      await createRestaurant({ name })
      setName('')
      await reload()
    } catch {
      setFormError('No se pudo crear el restaurante. Intentá de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-600">Cargando…</p>
  }

  if (error) {
    return (
      <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    )
  }

  if (!restaurant) {
    return (
      <div className="max-w-md rounded-xl bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900">Creá tu restaurante</h1>
        <p className="mb-6 text-sm text-gray-600">
          Todavía no tenés un restaurante. Empezá poniéndole un nombre.
        </p>

        {formError && (
          <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
            {formError}
          </div>
        )}

        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
              Nombre del restaurante
            </label>
            <input
              id="name"
              name="name"
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || name.trim() === ''}
            className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Creando…' : 'Crear restaurante'}
          </button>
        </form>
      </div>
    )
  }

  const publicPath = `/menu/${restaurant.qr_token}`

  return (
    <div className="max-w-2xl rounded-xl bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-gray-900">{restaurant.name}</h1>
      <dl className="mt-4 space-y-3 text-sm">
        <div>
          <dt className="font-medium text-gray-500">Slug</dt>
          <dd className="text-gray-900">{restaurant.slug}</dd>
        </div>
        <div>
          <dt className="font-medium text-gray-500">Menú público</dt>
          <dd>
            <Link to={publicPath} className="font-medium text-gray-900 underline break-all">
              {publicPath}
            </Link>
          </dd>
        </div>
      </dl>
    </div>
  )
}
