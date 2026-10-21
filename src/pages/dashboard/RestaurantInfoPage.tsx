import React, { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import { isOwner } from '../../lib/restaurants'
import {
  getRestaurantInfo,
  updateRestaurantInfo,
  replaceBusinessHours,
} from '../../lib/restaurantInfo'
import { ApiError } from '../../lib/api'
import { formatSchedule } from '../../lib/businessHours'
import type { RestaurantInfo } from '../../lib/types'
import LogoUpload from '../../components/dashboard/LogoUpload'

// The dashboard "Información del local" page (P6) — contact info editor +
// 7-day business hours grid + logo upload. Owner-only on the mutations; the
// read is editor-visible (matches the rest of /dashboard). All three pieces
// share a single GET /info load so the page opens with all data materialized,
// then each form PATCHes/PUTs independently — no giant "save all" button.

const WEEKDAY_LABELS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
// A small curated set of IANA tz names covering the main Spanish-speaking
// Latin America time zones plus a few defaults. Keeps the picker a <select>
// (no tz library required); owners in an unlisted tz fall back to typing in
// the (still editable) input. The server validates via `ZoneInfo` at PATCH.
const TZ_SUGGESTIONS = [
  'America/Argentina/Buenos_Aires',
  'America/Argentina/Cordoba',
  'America/Argentina/Mendoza',
  'America/Bogota',
  'America/Caracas',
  'America/Santiago',
  'America/Lima',
  'America/Montevideo',
  'America/Mexico_City',
  'America/Asuncion',
  'America/La_Paz',
  'America/Guayaquil',
  'UTC',
]

export default function RestaurantInfoPage(): React.JSX.Element {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useMyRestaurant()
  const restaurantId = restaurant?.id ?? null

  const [info, setInfo] = useState<RestaurantInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)

  // — Contact info form state — kept parallel to the loaded values so a
  // "Guardar" only PATCHes the dirty fields. Same convention as AppearancePage.
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsappPhone, setWhatsappPhone] = useState('')
  const [timezone, setTimezone] = useState('')

  const [savingInfo, setSavingInfo] = useState(false)
  const [infoStatus, setInfoStatus] = useState<'success' | 'error' | null>(null)
  const [infoError, setInfoError] = useState<string | null>(null)

  // — Hours grid state — 7 rows, each with enabled + open/close. The grid
  // replaces the whole week atomically on save, so untouched rows are simply
  // dropped (the dashboard's source of truth). Local time inputs of HH:MM.
  type HoursRow = { enabled: boolean; open: string; close: string }
  const emptyRow: HoursRow = { enabled: false, open: '09:00', close: '18:00' }
  const [hoursRows, setHoursRows] = useState<HoursRow[]>(Array.from({ length: 7 }, () => ({ ...emptyRow })))
  const [savingHours, setSavingHours] = useState(false)
  const [hoursStatus, setHoursStatus] = useState<'success' | 'error' | null>(null)
  const [hoursError, setHoursError] = useState<string | null>(null)

  async function reloadInfo(id: string): Promise<void> {
    setLoading(true)
    setLoadError(null)
    try {
      const data = await getRestaurantInfo(id)
      setInfo(data)
      setAddress(data.address)
      setPhone(data.phone)
      setWhatsappPhone(data.whatsapp_phone ?? '')
      setTimezone(data.timezone)
      const rows: HoursRow[] = Array.from({ length: 7 }, (_, weekday) => {
        const bh = data.business_hours.find((h) => h.weekday === weekday)
        if (bh === undefined) return { ...emptyRow }
        // Drop the seconds so the <input type="time"> value parses cleanly.
        const trim = (t: string) => (t.length >= 5 ? t.slice(0, 5) : t)
        return { enabled: true, open: trim(bh.open_time), close: trim(bh.close_time) }
      })
      setHoursRows(rows)
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : 'No se pudo cargar la información.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (restaurantId === null) return
    void reloadInfo(restaurantId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [restaurantId])

  const schedulePreview = useMemo(
    () => (info ? formatSchedule(info.business_hours) : ''),
    [info],
  )

  async function handleInfoSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (restaurantId === null || info === null) return
    setSavingInfo(true)
    setInfoStatus(null)
    setInfoError(null)
    try {
      // PATCH only the dirty fields — an unchanged field stays unset in the
      // payload so the server leaves the column alone (exclude_unset semantics).
      const patch: Record<string, string | null> = {}
      if (address !== info.address) patch.address = address
      if (phone !== info.phone) patch.phone = phone
      // Empty string on the client → null on the wire (clear) — the server
      // schema treats empty as null too, but normalizing here keeps the diff
      // detection clean (a "clear" still counts as a change).
      const nextWhatsapp = whatsappPhone === '' ? null : whatsappPhone
      if (nextWhatsapp !== info.whatsapp_phone) patch.whatsapp_phone = whatsappPhone
      if (timezone !== info.timezone) patch.timezone = timezone

      const updated = await updateRestaurantInfo(restaurantId, patch)
      setInfo(updated)
      setInfoStatus('success')
    } catch (err) {
      setInfoStatus('error')
      setInfoError(err instanceof ApiError ? err.message : 'No se pudo guardar la información.')
    } finally {
      setSavingInfo(false)
    }
  }

  async function handleHoursSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (restaurantId === null) return
    setSavingHours(true)
    setHoursStatus(null)
    setHoursError(null)
    try {
      // Build the bulk PUT payload from enabled rows. The backend rejects
      // duplicate weekdays and validates close>open; a row whose close <= open
      // surfaces as a 422 with a clear field error from pydantic.
      const payload = hoursRows
        .map((row, weekday) => ({ row, weekday }))
        .filter((r) => r.row.enabled)
        .map((r) => ({
          weekday: r.weekday,
          open_time: `${r.row.open}:00`,
          close_time: `${r.row.close}:00`,
        }))
      await replaceBusinessHours(restaurantId, payload)
      await reloadInfo(restaurantId) // re-fetch so is_open_now reflects the new schedule
      setHoursStatus('success')
    } catch (err) {
      setHoursStatus('error')
      setHoursError(err instanceof ApiError ? err.message : 'No se pudo guardar el horario.')
    } finally {
      setSavingHours(false)
    }
  }

  function handleRowChange(idx: number, patch: Partial<HoursRow>): void {
    setHoursRows((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)),
    )
  }

  if (restaurantLoading || loading || (restaurantId !== null && info === null && loadError === null)) {
    return <p className="text-sm text-gray-600 dark:text-gray-300">Cargando…</p>
  }

  if (restaurantError || loadError) {
    return (
      <div role="alert" className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
        {restaurantError ?? loadError}
      </div>
    )
  }

  if (!restaurant) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-300">
        Creá tu restaurante primero desde “Mi restaurante”.
      </p>
    )
  }

  // M15 RF-03: PATCH /info, PUT /business-hours and the 3 logo endpoints are
  // owner-only on the backend; the GET (what loads this page) is editor-visible.
  const canEdit = isOwner(restaurant)

  return (
    <div className="space-y-6">
      <div className="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-gray-900 dark:text-gray-100">Información del local</h1>
        {info && (
          <p className="mb-5 text-xs text-gray-500 dark:text-gray-400">
            {info.is_open_now ? 'Abierto ahora' : 'Cerrado'}
            {schedulePreview !== '' && ` · ${schedulePreview}`}
          </p>
        )}

        {/* Logo uploader sits above the contact form — it has its own save
            flow (presigned PUT + confirm) and doesn't share the form's submit. */}
        <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <h2 className="mb-1 text-sm font-semibold text-gray-900 dark:text-gray-100">Logo</h2>
          <p className="mb-3 text-xs text-gray-500 dark:text-gray-400">
            Se muestra en el encabezado del menú público. JPG, PNG o WEBP, hasta 5&nbsp;MB.
          </p>
          <LogoUpload
            restaurantId={restaurant.id}
            logoUrl={info?.logo_url ?? null}
            onLogoChange={() => void reloadInfo(restaurant.id)}
            disabled={!canEdit}
          />
        </div>

        {/* Contact info form */}
        {!canEdit && (
          <p
            id="info-owner-only"
            className="mb-4 rounded-md bg-gray-50 dark:bg-gray-950 px-3 py-2 text-xs text-gray-500 dark:text-gray-400"
          >
            Solo el administrador del restaurante puede modificar esta información.
          </p>
        )}
        <form
          onSubmit={handleInfoSubmit}
          className="space-y-4"
          noValidate
          aria-describedby={canEdit ? undefined : 'info-owner-only'}
        >
          <div>
            <label htmlFor="address" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Dirección
            </label>
            <input
              id="address"
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              maxLength={300}
              disabled={!canEdit}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="phone" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Teléfono
            </label>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              maxLength={60}
              disabled={!canEdit}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
          </div>

          <div>
            <label htmlFor="whatsapp_phone" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              WhatsApp (opcional)
            </label>
            <input
              id="whatsapp_phone"
              type="tel"
              value={whatsappPhone}
              onChange={(e) => setWhatsappPhone(e.target.value)}
              placeholder="+54 9 11 1234-5678"
              maxLength={20}
              disabled={!canEdit}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Si lo seteás, el checkout del menú público ofrece un botón
              “Confirmar por WhatsApp”. Formato: 6 a 15 dígitos, con o sin <code>+</code>.
            </p>
          </div>

          <div>
            <label htmlFor="timezone" className="mb-1 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Zona horaria
            </label>
            <input
              id="timezone"
              type="text"
              list="tz-suggestions"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              placeholder="America/Argentina/Buenos_Aires"
              disabled={!canEdit}
              className="w-full rounded-md border border-gray-300 dark:border-gray-600 px-3 py-2 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            />
            <datalist id="tz-suggestions">
              {TZ_SUGGESTIONS.map((tz) => (
                <option key={tz} value={tz} />
              ))}
            </datalist>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Nombre IANA. Vacío usa el default del servidor. Determina si el local
              aparece “Abierto” o “Cerrado” en el menú público.
            </p>
          </div>

          {infoStatus === 'success' && (
            <div role="status" className="rounded-md bg-green-50 dark:bg-green-950 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              Información guardada.
            </div>
          )}
          {infoStatus === 'error' && (
            <div role="alert" className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
              {infoError ?? 'No se pudieron guardar los cambios.'}
            </div>
          )}

          <button
            type="submit"
            disabled={savingInfo || !canEdit}
            className="w-full rounded-md bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingInfo ? 'Guardando…' : 'Guardar información'}
          </button>
        </form>
      </div>

      {/* Business hours grid */}
      <div className="rounded-xl bg-white dark:bg-gray-900 p-6 shadow-sm">
        <h2 className="mb-1 text-base font-semibold text-gray-900 dark:text-gray-100">Horarios de atención</h2>
        <p className="mb-4 text-xs text-gray-500 dark:text-gray-400">
          Activá los días que abrís y cargá el rango. Guardar reemplaza toda la semana.
        </p>

        {!canEdit && (
          <p
            id="hours-owner-only"
            className="mb-3 rounded-md bg-gray-50 dark:bg-gray-950 px-3 py-2 text-xs text-gray-500 dark:text-gray-400"
          >
            Solo el administrador del restaurante puede modificar los horarios.
          </p>
        )}

        <form
          onSubmit={handleHoursSubmit}
          className="space-y-3"
          noValidate
          aria-describedby={canEdit ? undefined : 'hours-owner-only'}
        >
          <ul className="space-y-2">
            {hoursRows.map((row, idx) => (
              <li key={idx} className="flex flex-wrap items-center gap-3 rounded-md border border-gray-200 dark:border-gray-700 px-3 py-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
                  <input
                    type="checkbox"
                    checked={row.enabled}
                    disabled={!canEdit}
                    onChange={(e) => handleRowChange(idx, { enabled: e.target.checked })}
                    className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-gray-900 dark:text-gray-100 focus:ring-gray-900 dark:focus:ring-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                  />
                  {WEEKDAY_LABELS[idx]}
                </label>
                {row.enabled && (
                  <div className="flex items-center gap-2">
                    <label className="sr-only" htmlFor={`open-${idx}`}>Desde</label>
                    <input
                      id={`open-${idx}`}
                      type="time"
                      value={row.open}
                      disabled={!canEdit}
                      onChange={(e) => handleRowChange(idx, { open: e.target.value })}
                      className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                    <span className="text-sm text-gray-500 dark:text-gray-400">a</span>
                    <label className="sr-only" htmlFor={`close-${idx}`}>Hasta</label>
                    <input
                      id={`close-${idx}`}
                      type="time"
                      value={row.close}
                      disabled={!canEdit}
                      onChange={(e) => handleRowChange(idx, { close: e.target.value })}
                      className="rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>

          {hoursStatus === 'success' && (
            <div role="status" className="rounded-md bg-green-50 dark:bg-green-950 px-3 py-2 text-sm text-green-700 dark:text-green-400">
              Horarios guardados.
            </div>
          )}
          {hoursStatus === 'error' && (
            <div role="alert" className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
              {hoursError ?? 'No se pudieron guardar los horarios.'}
            </div>
          )}

          <button
            type="submit"
            disabled={savingHours || !canEdit}
            className="w-full rounded-md bg-gray-900 dark:bg-gray-100 px-4 py-2 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {savingHours ? 'Guardando…' : 'Guardar horarios'}
          </button>
        </form>
      </div>
    </div>
  )
}