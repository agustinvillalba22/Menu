import React, { useEffect, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import {
  getItemImageUploadUrl,
  confirmItemImageUpload,
  deleteItemImage,
} from '../../lib/catalog'
import { ApiError } from '../../lib/api'
import { uploadImageToR2 } from '../../lib/r2'

interface ItemImageUploadProps {
  restaurantId: string
  subcategoryId: string
  itemId: string
  imageUrl: string | null
  onImageChange: (imageUrl: string | null) => void
}

// Mirror of the backend limits: only these MIME types, max 5 MiB.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

/**
 * Dashboard control to upload / replace / remove an item's image. Reproduces
 * the presigned-PUT + confirm flow in the browser: request a presigned URL,
 * PUT the file straight to R2, confirm against the backend, and only then
 * surface the new image (never optimistically before confirmation).
 */
export default function ItemImageUpload({
  restaurantId,
  subcategoryId,
  itemId,
  imageUrl,
  onImageChange,
}: ItemImageUploadProps): React.JSX.Element {
  // Internal display state so the component reflects a just-confirmed image
  // even before the parent re-passes it via props. Synced to the prop when the
  // parent updates it.
  const [displayUrl, setDisplayUrl] = useState<string | null>(imageUrl)
  const [busyAction, setBusyAction] = useState<'upload' | 'delete' | null>(null)
  const busy = busyAction !== null
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDisplayUrl(imageUrl)
  }, [imageUrl])

  function openPicker(): void {
    inputRef.current?.click()
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = '' // allow re-selecting the same file later
    if (!file) return

    setError(null)
    if (!ALLOWED_TYPES.includes(file.type)) {
      setError('Formato no soportado (usar JPG, PNG o WEBP)')
      return
    }
    if (file.size > MAX_SIZE) {
      setError('El archivo supera el tamaño máximo (5 MB)')
      return
    }

    setBusyAction('upload')
    try {
      const res = await getItemImageUploadUrl(restaurantId, subcategoryId, itemId, {
        content_type: file.type,
        file_size: file.size,
      })
      await uploadImageToR2(res.upload_url, file)
      const updated = await confirmItemImageUpload(restaurantId, subcategoryId, itemId, res.object_key)
      setDisplayUrl(updated.image_url)
      onImageChange(updated.image_url)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir la imagen.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleDelete(): Promise<void> {
    setBusyAction('delete')
    setError(null)
    try {
      await deleteItemImage(restaurantId, subcategoryId, itemId)
      setDisplayUrl(null)
      onImageChange(null)
      setConfirmingDelete(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo quitar la imagen.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="mt-2 flex items-start gap-3">
      <input
        ref={inputRef}
        type="file"
        aria-label="Archivo de imagen del producto"
        disabled={busy}
        onChange={handleFileChange}
        className="hidden"
      />

      {displayUrl ? (
        <img src={displayUrl} alt="Imagen del producto" className="h-16 w-16 rounded object-cover" />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
          <ImageOff className="h-6 w-6" aria-hidden="true" />
        </div>
      )}

      <div className="flex flex-col gap-1">
        {busyAction === 'upload' ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">Subiendo imagen…</span>
        ) : busyAction === 'delete' ? (
          <span className="text-xs text-gray-500 dark:text-gray-400">Quitando imagen…</span>
        ) : displayUrl ? (
          confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600 dark:text-gray-300">¿Quitar la imagen?</span>
              <button
                type="button"
                onClick={handleDelete}
                className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Sí, quitar
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={openPicker}
                className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
              >
                Reemplazar
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-400"
              >
                Quitar
              </button>
            </div>
          )
        ) : (
          <button
            type="button"
            onClick={openPicker}
            className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-100"
          >
            Subir imagen
          </button>
        )}

        {error && (
          <div role="alert" className="text-xs text-red-700 dark:text-red-400">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}
