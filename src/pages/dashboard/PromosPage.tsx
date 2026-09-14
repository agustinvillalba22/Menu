import React, { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { Megaphone, Trash2, Pencil, X } from 'lucide-react'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import { ApiError } from '../../lib/api'
import {
  listPromos,
  createPromo,
  updatePromo,
  deletePromo,
  getPromoImageUploadUrl,
  uploadPromoImageToR2,
  confirmPromoImage,
  deletePromoImage,
} from '../../lib/promos'
import {
  listCategories,
  listSubcategories,
  listItems,
} from '../../lib/menu'
import type { Item, Promo, PromoUpdate } from '../../lib/types'

// The dashboard "Promos" page (P4/P5, Fase 2c/2d): list + create/edit form
// (texto, % desc, vigencia, producto vinculado, imagen R2) + the P5 expiry
// notice. Same conventions as RestaurantInfoPage: one load on mount, each
// action re-fetches, server responses are the single source of truth.

// Mirror of the backend limits (Fase 0b shared image set): jpg/png/webp, 5 MiB.
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE = 5 * 1024 * 1024

// P5 — a promo expiring within this many days triggers the notice banner.
const EXPIRY_NOTICE_DAYS = 3

const ERROR_MESSAGES: Record<string, string> = {
  invalid_promo_window: 'La fecha de fin debe ser posterior a la de inicio.',
  naive_datetime: 'Elegí fecha y hora válidas para la vigencia.',
  item_not_found: 'El producto vinculado ya no existe.',
  unsupported_content_type: 'Formato no soportado (usar JPG, PNG o WEBP).',
  file_too_large: 'El archivo supera el tamaño máximo (5 MB).',
}

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.code !== null && ERROR_MESSAGES[err.code]) {
    return ERROR_MESSAGES[err.code]
  }
  return err instanceof ApiError ? err.message : fallback
}

/** ISO (server) -> value for <input type="datetime-local"> (local tz). */
function isoToLocalInput(iso: string | null): string {
  if (iso === null || iso === '') return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** datetime-local value -> aware ISO for the wire ('' -> null = clear). */
function localInputToIso(value: string): string | null {
  if (value === '') return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d.toISOString()
}

type FormState = {
  title: string
  subtitle: string
  description: string
  discountPct: string
  itemId: string
  startsAt: string
  endsAt: string
  isActive: boolean
}

const EMPTY_FORM: FormState = {
  title: '',
  subtitle: '',
  description: '',
  discountPct: '',
  itemId: '',
  startsAt: '',
  endsAt: '',
  isActive: false,
}

function formFromPromo(promo: Promo): FormState {
  return {
    title: promo.title,
    subtitle: promo.subtitle ?? '',
    description: promo.description ?? '',
    discountPct: promo.discount_pct === null ? '' : String(promo.discount_pct),
    itemId: promo.item_id ?? '',
    startsAt: isoToLocalInput(promo.starts_at),
    endsAt: isoToLocalInput(promo.ends_at),
    isActive: promo.is_active,
  }
}

export default function PromosPage(): React.JSX.Element {
  const { restaurant, loading: restaurantLoading, error: restaurantError } =
    useMyRestaurant()
  const restaurantId = restaurant?.id ?? null

  const [promos, setPromos] = useState<Promo[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // Items for the "producto vinculado" select — loaded once with the promos.
  const [items, setItems] = useState<{ id: string; name: string }[]>([])

  // 'new' | editing promo id | null (list mode).
  const [editing, setEditing] = useState<'new' | string | null>(null)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  // P5 notice (dismissible; recomputed on every load).
  const [noticeDismissed, setNoticeDismissed] = useState(false)

  // Image upload state (only in edit mode — the R2 URL is per-promo).
  const [imageBusy, setImageBusy] = useState(false)
  const [imageError, setImageError] = useState<string | null>(null)

  async function reload(id: string): Promise<void> {
    setLoading(true)
    setLoadError(null)
    setNoticeDismissed(false)
    try {
      const [promoList, categoryList] = await Promise.all([
        listPromos(id),
        listCategories(id),
      ])
      setPromos(promoList)
      const itemOptions: { id: string; name: string }[] = []
      for (const category of categoryList) {
        const subs = await listSubcategories(id, category.id)
        for (const sub of subs) {
          const itemList: Item[] = await listItems(id, sub.id)
          for (const item of itemList) {
            itemOptions.push({ id: item.id, name: item.name })
          }
        }
      }
      setItems(itemOptions)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudieron cargar las promos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (restaurantId === null) return
    void reload(restaurantId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  const editingPromo =
    editing !== null && editing !== 'new'
      ? promos.find((p) => p.id === editing) ?? null
      : null

  function startCreate(): void {
    setEditing('new')
    setForm(EMPTY_FORM)
    setFormError(null)
  }

  function startEdit(promo: Promo): void {
    setEditing(promo.id)
    setForm(formFromPromo(promo))
    setFormError(null)
  }

  function cancelEdit(): void {
    setEditing(null)
    setFormError(null)
    setImageError(null)
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (restaurantId === null) return
    setSaving(true)
    setFormError(null)
    try {
      const discount =
        form.discountPct === '' ? null : Number.parseInt(form.discountPct, 10)
      if (discount !== null && (Number.isNaN(discount) || discount < 0 || discount > 100)) {
        setFormError('El descuento debe ser un número entre 0 y 100.')
        return
      }

      if (editing === 'new') {
        await createPromo(restaurantId, {
          title: form.title,
          subtitle: form.subtitle === '' ? null : form.subtitle,
          description: form.description === '' ? null : form.description,
          discount_pct: discount,
          item_id: form.itemId === '' ? null : form.itemId,
          is_active: form.isActive,
          starts_at: localInputToIso(form.startsAt),
          ends_at: localInputToIso(form.endsAt),
        })
      } else if (editing !== null && editingPromo !== null) {
        // PATCH only the dirty fields (exclude_unset semantics server-side).
        const patch: PromoUpdate = {}
        if (form.title !== editingPromo.title) patch.title = form.title
        const nextSubtitle = form.subtitle === '' ? null : form.subtitle
        if (nextSubtitle !== editingPromo.subtitle) patch.subtitle = nextSubtitle
        const nextDescription = form.description === '' ? null : form.description
        if (nextDescription !== editingPromo.description) patch.description = nextDescription
        if (discount !== editingPromo.discount_pct) patch.discount_pct = discount
        const nextItemId = form.itemId === '' ? null : form.itemId
        if (nextItemId !== editingPromo.item_id) patch.item_id = nextItemId
        if (form.isActive !== editingPromo.is_active) patch.is_active = form.isActive
        const nextStarts = localInputToIso(form.startsAt)
        if (nextStarts !== (editingPromo.starts_at === null ? null : new Date(editingPromo.starts_at).toISOString())) {
          patch.starts_at = nextStarts
        }
        const nextEnds = localInputToIso(form.endsAt)
        if (nextEnds !== (editingPromo.ends_at === null ? null : new Date(editingPromo.ends_at).toISOString())) {
          patch.ends_at = nextEnds
        }
        await updatePromo(restaurantId, editing, patch)
      }

      setEditing(null)
      await reload(restaurantId)
    } catch (err) {
      setFormError(errorMessage(err, 'No se pudo guardar la promo.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleToggleActive(promo: Promo): Promise<void> {
    if (restaurantId === null) return
    try {
      await updatePromo(restaurantId, promo.id, { is_active: !promo.is_active })
      await reload(restaurantId)
    } catch (err) {
      setLoadError(errorMessage(err, 'No se pudo cambiar el estado de la promo.'))
    }
  }

  async function handleDelete(promo: Promo): Promise<void> {
    if (restaurantId === null) return
    if (!window.confirm(`¿Eliminar la promo "${promo.title}"?`)) return
    try {
      await deletePromo(restaurantId, promo.id)
      if (editing === promo.id) cancelEdit()
      await reload(restaurantId)
    } catch (err) {
      setLoadError(errorMessage(err, 'No se pudo eliminar la promo.'))
    }
  }

  async function handleImageChange(
    e: React.ChangeEvent<HTMLInputElement>,
  ): Promise<void> {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || restaurantId === null || editing === null || editing === 'new') return
    setImageError(null)
    if (!ALLOWED_TYPES.includes(file.type)) {
      setImageError('Formato no soportado (usar JPG, PNG o WEBP)')
      return
    }
    if (file.size > MAX_SIZE) {
      setImageError('El archivo supera el tamaño máximo (5 MB)')
      return
    }
    setImageBusy(true)
    try {
      const res = await getPromoImageUploadUrl(restaurantId, editing, {
        content_type: file.type,
        file_size: file.size,
      })
      await uploadPromoImageToR2(res.upload_url, file)
      await confirmPromoImage(restaurantId, editing, res.object_key)
      await reload(restaurantId)
    } catch (err) {
      setImageError(errorMessage(err, 'No se pudo subir la imagen.'))
    } finally {
      setImageBusy(false)
    }
  }

  async function handleDeleteImage(): Promise<void> {
    if (restaurantId === null || editing === null || editing === 'new') return
    setImageBusy(true)
    setImageError(null)
    try {
      await deletePromoImage(restaurantId, editing)
      await reload(restaurantId)
    } catch (err) {
      setImageError(errorMessage(err, 'No se pudo quitar la imagen.'))
    } finally {
      setImageBusy(false)
    }
  }

  // P5 — active promos expiring soon (or today) drive the notice banner.
  const expiringSoon = promos.filter(
    (p) =>
      p.is_active &&
      p.days_remaining !== null &&
      p.days_remaining <= EXPIRY_NOTICE_DAYS,
  )

  if (restaurantLoading) {
    return <p className="text-sm text-gray-600">Cargando…</p>
  }
  if (restaurantError !== null || restaurantId === null) {
    return <p className="text-sm text-red-700">{restaurantError ?? 'Sin restaurante'}</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Promos</h1>
          <p className="text-sm text-gray-600">
            Banner promocional visible en el menú público mientras esté activo
            y dentro de su vigencia.
          </p>
        </div>
        {editing === null && (
          <button
            type="button"
            onClick={startCreate}
            className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            Nueva promo
          </button>
        )}
      </div>

      {/* P5 — in-app expiry notice (toast-style, dismissible). */}
      {expiringSoon.length > 0 && !noticeDismissed && (
        <div
          role="alert"
          aria-live="polite"
          className="flex items-start justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          <div className="flex items-start gap-2">
            <Megaphone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p data-testid="promo-expiry-notice">
              {expiringSoon.length === 1 ? (
                <>
                  La promo <strong>{expiringSoon[0].title}</strong>{' '}
                  {expiringSoon[0].days_remaining === 0
                    ? 'vence hoy'
                    : `vence en ${expiringSoon[0].days_remaining} día(s)`}
                  .
                </>
              ) : (
                <>
                  {expiringSoon.length} promos activas vencen en menos de{' '}
                  {EXPIRY_NOTICE_DAYS} días.
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            aria-label="Descartar aviso"
            onClick={() => setNoticeDismissed(true)}
            className="shrink-0 rounded p-1 hover:bg-amber-100"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {loading && <p className="text-sm text-gray-500">Actualizando…</p>}
      {loadError !== null && (
        <p role="alert" className="text-sm text-red-700">
          {loadError}
        </p>
      )}

      {/* — Form (create / edit) — */}
      {editing !== null && (
        <form
          onSubmit={handleSubmit}
          className="space-y-4 rounded-xl bg-white p-5 shadow-sm"
        >
          <h2 className="text-base font-semibold text-gray-900">
            {editing === 'new' ? 'Nueva promo' : 'Editar promo'}
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Título *</span>
              <input
                required
                maxLength={120}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Subtítulo</span>
              <input
                maxLength={160}
                value={form.subtitle}
                onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-gray-700">Descripción</span>
              <textarea
                maxLength={1000}
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Descuento (%)</span>
              <input
                type="number"
                min={0}
                max={100}
                value={form.discountPct}
                onChange={(e) => setForm({ ...form, discountPct: e.target.value })}
                placeholder="Ej: 20"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Producto vinculado</span>
              <select
                value={form.itemId}
                onChange={(e) => setForm({ ...form, itemId: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="">Ninguno</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Vigencia desde</span>
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => setForm({ ...form, startsAt: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Vigencia hasta</span>
              <input
                type="datetime-local"
                value={form.endsAt}
                onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
              className="h-4 w-4"
            />
            Activa (visible en el menú público dentro de su vigencia)
          </label>

          {/* Image — only for an existing promo (the R2 URL is per-promo id). */}
          {editing !== 'new' && editingPromo !== null && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-gray-700">Imagen del banner</p>
              <div className="flex items-center gap-4">
                {editingPromo.image_url ? (
                  <img
                    src={editingPromo.image_url}
                    alt={`Imagen de ${editingPromo.title}`}
                    className="h-16 w-28 rounded-md border border-gray-200 object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-28 items-center justify-center rounded-md bg-gray-100 text-xs text-gray-400">
                    Sin imagen
                  </div>
                )}
                <div className="flex flex-col gap-1.5">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    aria-label="Imagen de la promo"
                    disabled={imageBusy}
                    onChange={handleImageChange}
                    className="text-xs"
                  />
                  {editingPromo.image_url && (
                    <button
                      type="button"
                      onClick={handleDeleteImage}
                      disabled={imageBusy}
                      className="text-left text-xs font-medium text-red-600 hover:text-red-800"
                    >
                      Quitar imagen
                    </button>
                  )}
                  {imageBusy && <span className="text-xs text-gray-500">Subiendo…</span>}
                  {imageError !== null && (
                    <span role="alert" className="text-xs text-red-700">
                      {imageError}
                    </span>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Guardá los cambios de texto primero; la imagen se sube aparte y
                se confirma sola.
              </p>
            </div>
          )}

          {formError !== null && (
            <p role="alert" className="text-sm text-red-700">
              {formError}
            </p>
          )}

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-60"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* — List — */}
      <div className="space-y-3">
        {promos.length === 0 && !loading && (
          <p className="rounded-xl bg-white p-5 text-sm text-gray-600 shadow-sm">
            Todavía no hay promos. Creá una para mostrarla como banner en tu
            menú público.
          </p>
        )}
        {promos.map((promo) => (
          <div
            key={promo.id}
            className="flex items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm"
          >
            <div className="flex min-w-0 items-center gap-3">
              {promo.image_url && (
                <img
                  src={promo.image_url}
                  alt=""
                  className="h-10 w-16 shrink-0 rounded-md border border-gray-200 object-cover"
                />
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-900">
                  {promo.title}
                  {promo.discount_pct !== null && (
                    <span className="ml-2 font-black text-amber-600">
                      {promo.discount_pct}% OFF
                    </span>
                  )}
                </p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span
                    className={
                      'rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ' +
                      (promo.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-gray-100 text-gray-500')
                    }
                  >
                    {promo.is_active ? 'Activa' : 'Inactiva'}
                  </span>
                  {/* P5 badge — server-computed days_remaining. */}
                  {promo.days_remaining !== null && (
                    <span
                      data-testid={`promo-days-${promo.id}`}
                      className={
                        'rounded-full px-2 py-0.5 text-[10px] font-bold ' +
                        (promo.days_remaining <= EXPIRY_NOTICE_DAYS
                          ? 'bg-red-100 text-red-800'
                          : 'bg-amber-100 text-amber-800')
                      }
                    >
                      {promo.days_remaining === 0
                        ? 'Vence hoy'
                        : `Vence en ${promo.days_remaining}d`}
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => void handleToggleActive(promo)}
                className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100"
              >
                {promo.is_active ? 'Pausar' : 'Activar'}
              </button>
              <button
                type="button"
                aria-label={`Editar ${promo.title}`}
                onClick={() => startEdit(promo)}
                className="rounded-md border border-gray-300 p-1.5 text-gray-600 hover:bg-gray-100"
              >
                <Pencil className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                aria-label={`Eliminar ${promo.title}`}
                onClick={() => void handleDelete(promo)}
                className="rounded-md border border-gray-300 p-1.5 text-red-600 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
