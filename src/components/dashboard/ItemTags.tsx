import React, { useState } from 'react'
import type { FormEvent } from 'react'
import { addTag, removeTag } from '../../lib/menu'
import { ApiError } from '../../lib/api'
import { badgeInfo } from '../public/badges'
import type { Tag } from '../../lib/types'

/** Curated set of dietary tags (M12.2). Canonical names — used verbatim when
 *  adding a tag so the backend stores exactly one of these five spellings. */
const CURATED_TAGS = ['Sin TACC', 'Sin lácteos', 'Vegetariano', 'Vegano', 'Picante'] as const

interface ItemTagsProps {
  restaurantId: string
  subcategoryId: string
  itemId: string
  tags: Tag[]
  onTagsChange: (tags: Tag[]) => void
}

export default function ItemTags({
  restaurantId,
  subcategoryId,
  itemId,
  tags,
  onTagsChange,
}: ItemTagsProps): React.JSX.Element {
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAdd(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    const trimmed = name.trim()
    if (trimmed === '') return
    setBusy(true)
    setError(null)
    try {
      const tag = await addTag(restaurantId, subcategoryId, itemId, { name: trimmed })
      if (!tags.some((t) => t.id === tag.id)) {
        onTagsChange([...tags, tag])
      }
      setName('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo agregar el tag.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(tagId: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await removeTag(restaurantId, subcategoryId, itemId, tagId)
      onTagsChange(tags.filter((t) => t.id !== tagId))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo eliminar el tag.')
    } finally {
      setBusy(false)
    }
  }

  async function handleToggleCurated(tagName: string): Promise<void> {
    const existing = tags.find((t) => t.name.trim().toLowerCase() === tagName.toLowerCase())
    setBusy(true)
    setError(null)
    try {
      if (existing) {
        await removeTag(restaurantId, subcategoryId, itemId, existing.id)
        onTagsChange(tags.filter((t) => t.id !== existing.id))
      } else {
        const tag = await addTag(restaurantId, subcategoryId, itemId, { name: tagName })
        if (!tags.some((t) => t.id === tag.id)) {
          onTagsChange([...tags, tag])
        }
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo actualizar el tag.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Tags dietéticos sugeridos">
        {CURATED_TAGS.map((tagName) => {
          const active = tags.some((t) => t.name.trim().toLowerCase() === tagName.toLowerCase())
          const badge = badgeInfo({ id: tagName, name: tagName })
          return (
            <button
              key={tagName}
              type="button"
              aria-pressed={active}
              disabled={busy}
              onClick={() => handleToggleCurated(tagName)}
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                active
                  ? 'border-gray-900 bg-gray-900 text-white'
                  : 'border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {badge && <span aria-hidden="true">{badge.emoji}</span>}
              {tagName}
            </button>
          )
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        {tags.map((tag) => (
          <span
            key={tag.id}
            className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-700"
          >
            {tag.name}
            <button
              type="button"
              onClick={() => handleRemove(tag.id)}
              disabled={busy}
              aria-label={`Eliminar tag ${tag.name}`}
              className="text-gray-400 hover:text-red-600 disabled:opacity-50"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      <form onSubmit={handleAdd} className="mt-2 flex items-center gap-2">
        <label htmlFor={`tag-${itemId}`} className="sr-only">
          Nuevo tag
        </label>
        <input
          id={`tag-${itemId}`}
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nuevo tag"
          className="w-32 rounded-md border border-gray-300 px-2 py-1 text-xs focus:border-gray-900 focus:outline-none"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100 disabled:opacity-50"
        >
          Agregar
        </button>
      </form>

      {error && (
        <div role="alert" className="mt-1 text-xs text-red-700">
          {error}
        </div>
      )}
    </div>
  )
}
