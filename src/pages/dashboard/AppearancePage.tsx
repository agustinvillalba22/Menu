import React, { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import { getStyle, updateStyle } from '../../lib/style'
import { THEME_PRESETS, type ThemePreset } from '../../lib/themePresets'
import type { FontFamily, Style, StyleUpdate } from '../../lib/types'

const FONT_OPTIONS: FontFamily[] = ['Inter', 'Playfair Display', 'Poppins', 'DM Sans']
const DEFAULT_PRIMARY = '#FC462F'
const DEFAULT_SECONDARY = '#FFE0E0'

/** Normalize a hex value to lowercase so PATCH diffs are case-stable — the
 * backend stores whatever bytes we send, and `<input type="color">` always
 * yields lowercase, so preset hexes must flow through the same pipe to avoid
 * spurious "the secondary_color changed!" diffs from a case-only delta. */
const norm = (hex: string): string => hex.toLowerCase()

export default function AppearancePage(): React.JSX.Element {
  const { restaurant, loading: restaurantLoading, error: restaurantError } = useMyRestaurant()

  const [initial, setInitial] = useState<Style | null>(null)
  const [fontFamily, setFontFamily] = useState<FontFamily>('Inter')
  const [primaryColor, setPrimaryColor] = useState<string>(DEFAULT_PRIMARY)
  const [secondaryColor, setSecondaryColor] = useState<string>(DEFAULT_SECONDARY)

  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [status, setStatus] = useState<'success' | 'error' | null>(null)

  const restaurantId = restaurant?.id ?? null

  // Match the current (primary, secondary, font) against a preset to highlight
  // its card in the grid. Computed per render — the inputs are the only source
  // of truth, so this stays consistent whether the owner clicked a preset or
  // tweaked a channel manually.
  const activePresetId = useMemo<string | null>(() => {
    const p = norm(primaryColor)
    const s = norm(secondaryColor)
    const match = THEME_PRESETS.find(
      (preset) =>
        norm(preset.primary_color) === p &&
        norm(preset.secondary_color) === s &&
        preset.font_family === fontFamily,
    )
    return match?.id ?? null
  }, [primaryColor, secondaryColor, fontFamily])

  function applyPreset(preset: ThemePreset): void {
    setFontFamily(preset.font_family)
    setPrimaryColor(norm(preset.primary_color))
    setSecondaryColor(norm(preset.secondary_color))
  }

  useEffect(() => {
    if (restaurantId === null) return
    let cancelled = false

    async function load(id: string): Promise<void> {
      setLoading(true)
      setLoadError(null)
      try {
        const style = await getStyle(id)
        if (cancelled) return
        setInitial(style)
        setFontFamily(style.font_family)
        setPrimaryColor(style.primary_color ?? DEFAULT_PRIMARY)
        setSecondaryColor(style.secondary_color ?? DEFAULT_SECONDARY)
      } catch {
        if (!cancelled) setLoadError('No se pudo cargar la apariencia.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load(restaurantId)
    return () => {
      cancelled = true
    }
  }, [restaurantId])

  async function handleSubmit(e: FormEvent<HTMLFormElement>): Promise<void> {
    e.preventDefault()
    if (restaurantId === null || initial === null) return
    setStatus(null)
    setSaving(true)

    const patch: StyleUpdate = {}
    if (fontFamily !== initial.font_family) patch.font_family = fontFamily
    if (primaryColor !== (initial.primary_color ?? DEFAULT_PRIMARY)) {
      patch.primary_color = primaryColor
    }
    if (secondaryColor !== (initial.secondary_color ?? DEFAULT_SECONDARY)) {
      patch.secondary_color = secondaryColor
    }

    try {
      const updated = await updateStyle(restaurantId, patch)
      setInitial(updated)
      setStatus('success')
    } catch {
      setStatus('error')
    } finally {
      setSaving(false)
    }
  }

  if (restaurantLoading || loading) {
    return <p className="text-sm text-gray-600">Cargando…</p>
  }

  if (restaurantError || loadError) {
    return (
      <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {restaurantError ?? loadError}
      </div>
    )
  }

  if (!restaurant) {
    return (
      <p className="text-sm text-gray-600">
        Creá tu restaurante primero desde “Mi restaurante”.
      </p>
    )
  }

  return (
    <div className="max-w-2xl rounded-xl bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Apariencia</h1>

      {status === 'success' && (
        <div role="status" className="mb-4 rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          Cambios guardados.
        </div>
      )}
      {status === 'error' && (
        <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          No se pudieron guardar los cambios.
        </div>
      )}

      {/* Preset grid — one click fills all three channels below. The cards
          act as shortcuts, not as a separate store: their `aria-pressed`
          state mirrors the active-preset computation so screen readers
          announce selection consistently with the visual highlight. */}
      <fieldset className="mb-6">
        <legend className="mb-2 block text-sm font-medium text-gray-700">
          Paletas predefinidas
        </legend>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {THEME_PRESETS.map((preset) => {
            const isActive = preset.id === activePresetId
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isActive}
                title={preset.description}
                onClick={() => applyPreset(preset)}
                className={`flex flex-col gap-2 rounded-lg border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-gray-900 ${
                  isActive
                    ? 'border-gray-900 ring-1 ring-gray-900'
                    : 'border-gray-200 hover:border-gray-400'
                }`}
              >
                <div
                  className="flex h-12 items-center justify-center rounded text-sm font-bold"
                  style={{
                    backgroundColor: norm(preset.secondary_color),
                    color: norm(preset.primary_color),
                  }}
                >
                  Aa
                </div>
                <span className="text-xs font-semibold text-gray-900">{preset.name}</span>
              </button>
            )
          })}
        </div>
      </fieldset>

      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div>
          <label htmlFor="font_family" className="mb-1 block text-sm font-medium text-gray-700">
            Tipografía
          </label>
          <select
            id="font_family"
            name="font_family"
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value as FontFamily)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-gray-900 focus:outline-none"
          >
            {FONT_OPTIONS.map((font) => (
              <option key={font} value={font}>
                {font}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="primary_color" className="mb-1 block text-sm font-medium text-gray-700">
            Color primario
          </label>
          <input
            id="primary_color"
            name="primary_color"
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            className="h-10 w-full rounded-md border border-gray-300"
          />
        </div>

        <div>
          <label htmlFor="secondary_color" className="mb-1 block text-sm font-medium text-gray-700">
            Color secundario
          </label>
          <input
            id="secondary_color"
            name="secondary_color"
            type="color"
            value={secondaryColor}
            onChange={(e) => setSecondaryColor(e.target.value)}
            className="h-10 w-full rounded-md border border-gray-300"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Guardando…' : 'Guardar'}
        </button>
      </form>
    </div>
  )
}