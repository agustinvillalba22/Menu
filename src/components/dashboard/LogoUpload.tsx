import React, { useEffect, useRef, useState } from 'react'
import { ImageOff } from 'lucide-react'
import {
  getLogoUploadUrl,
  uploadLogoToR2,
  confirmLogoUpload,
  deleteRestaurantLogo,
} from '../../lib/restaurantInfo'
import { ApiError } from '../../lib/api'

interface LogoUploadProps {
  restaurantId: string
  logoUrl: string | null
  /** Called when the logo row changes — the page re-fetches `/info` to refresh `is_open_now` etc. */
  onLogoChange: (logoUrl: string | null) => void
}

// Mirror of the backend limits (Fase 0b, same as item images): only these
// MIME types, max 5 MiB. Keeping the same set means a single fixture/test
// matrix covers both uploaders.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

/**
 * Logo uploader (P6) — dashboard control for the restaurant's header logo.
 * Mirrors `ItemImageUpload`: presigned PUT + confirm against the backend,
 * never optimistically swaps the image before confirmation (RNF-03 parity).
 *
 * Differences from the item counterpart:
 *  - No subcategory/item in scope — the URL is `/restaurants/{id}/logo/*`.
 *  - `onLogoChange` is the page-level re-fetch trigger, since the read shape
 *    (RestaurantInfo) is different from the item one (ItemRead).
 */
export default function LogoUpload({
  restaurantId,
  logoUrl,
  onLogoChange,
}: LogoUploadProps): React.JSX.Element {
  const [displayUrl, setDisplayUrl] = useState<string | null>(logoUrl)
  const [busyAction, setBusyAction] = useState<'upload' | 'delete' | null>(null)
  const busy = busyAction !== null
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setDisplayUrl(logoUrl)
  }, [logoUrl])

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
      const res = await getLogoUploadUrl(restaurantId, {
        content_type: file.type,
        file_size: file.size,
      })
      await uploadLogoToR2(res.upload_url, file)
      await confirmLogoUpload(restaurantId, res.object_key)
      // Don't invent a public URL on the client (we don't know R2_PUBLIC_URL).
      // The parent re-fetches /info and passes the new logo_url back through
      // props — `useEffect([logoUrl])` then syncs displayUrl. Keeping the
      // server response as the single source of truth matches RNF-03 parity
      // with the item image uploader.
      onLogoChange('refresh')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo subir el logo.')
    } finally {
      setBusyAction(null)
    }
  }

  async function handleDelete(): Promise<void> {
    setBusyAction('delete')
    setError(null)
    try {
      await deleteRestaurantLogo(restaurantId)
      setDisplayUrl(null)
      onLogoChange(null)
      setConfirmingDelete(false)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo quitar el logo.')
    } finally {
      setBusyAction(null)
    }
  }

  return (
    <div className="flex items-start gap-4">
      <input
        ref={inputRef}
        type="file"
        aria-label="Archivo de logo del restaurant"
        disabled={busy}
        onChange={handleFileChange}
        className="hidden"
      />

      {displayUrl ? (
        <img
          src={displayUrl}
          alt="Logo del restaurant"
          className="h-20 w-20 rounded-full border border-gray-200 object-cover"
        />
      ) : (
        <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gray-100 text-gray-400">
          <ImageOff className="h-7 w-7" aria-hidden="true" />
        </div>
      )}

      <div className="flex flex-col gap-1.5 pt-2">
        {busyAction === 'upload' ? (
          <span className="text-xs text-gray-500">Subiendo logo…</span>
        ) : busyAction === 'delete' ? (
          <span className="text-xs text-gray-500">Quitando logo…</span>
        ) : displayUrl ? (
          confirmingDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-600">¿Quitar el logo?</span>
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
                className="rounded-md border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                Cancelar
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={openPicker}
                className="text-xs text-gray-500 hover:text-gray-900"
              >
                Reemplazar
              </button>
              <button
                type="button"
                onClick={() => setConfirmingDelete(true)}
                className="text-xs font-medium text-red-600 hover:text-red-800"
              >
                Quitar
              </button>
            </div>
          )
        ) : (
          <button
            type="button"
            onClick={openPicker}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
          >
            Subir logo
          </button>
        )}

        {error && (
          <div role="alert" className="text-xs text-red-700">
            {error}
          </div>
        )}
      </div>
    </div>
  )
}