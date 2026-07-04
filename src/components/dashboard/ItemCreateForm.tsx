import React, { useState } from 'react'
import type { FormEvent } from 'react'
import type { ItemCreate } from '../../lib/types'

interface ItemCreateFormProps {
  subcategoryId: string
  // Returns true on success (fields are cleared) or false on failure.
  onCreate: (data: ItemCreate) => Promise<boolean>
}

export default function ItemCreateForm({
  subcategoryId,
  onCreate,
}: ItemCreateFormProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    setSubmitting(true)
    // price stays a string all the way to the backend — never Number().
    const ok = await onCreate({ name, description, price })
    if (ok) {
      setName('')
      setDescription('')
      setPrice('')
    }
    setSubmitting(false)
  }

  return (
    <form onSubmit={handleSubmit} className="mt-3 flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor={`new-item-name-${subcategoryId}`} className="sr-only">
          Nombre del nuevo ítem
        </label>
        <input
          id={`new-item-name-${subcategoryId}`}
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre"
          className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-gray-900 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor={`new-item-desc-${subcategoryId}`} className="sr-only">
          Descripción del nuevo ítem
        </label>
        <input
          id={`new-item-desc-${subcategoryId}`}
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Descripción"
          className="rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-gray-900 focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor={`new-item-price-${subcategoryId}`} className="sr-only">
          Precio del nuevo ítem
        </label>
        <input
          id={`new-item-price-${subcategoryId}`}
          type="text"
          required
          inputMode="decimal"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Precio"
          className="w-24 rounded-md border border-gray-300 px-2 py-1 text-sm focus:border-gray-900 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="rounded-md bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
      >
        {submitting ? 'Agregando…' : 'Agregar ítem'}
      </button>
    </form>
  )
}
