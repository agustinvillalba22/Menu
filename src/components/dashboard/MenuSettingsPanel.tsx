import React, { useState } from 'react'
import type { FormEvent } from 'react'
import { deleteMenu, updateMenu } from '../../lib/menus'
import { menuErrorMessage } from '../../lib/menuErrors'
import type { Menu, MenuUpdate } from '../../lib/types'

const DAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

interface MenuSettingsPanelProps {
  restaurantId: string
  menu: Menu
  onUpdated: (menu: Menu) => void
  onDeleted: (menuId: string) => void
}

function maskToDays(mask: number | null): boolean[] {
  return DAYS.map((_, i) => mask !== null && (mask & (1 << i)) !== 0)
}

function daysToMask(days: boolean[]): number | null {
  const mask = days.reduce((acc, on, i) => (on ? acc | (1 << i) : acc), 0)
  return mask === 0 ? null : mask
}

const trimTime = (t: string | null): string => (t ? t.slice(0, 5) : '')

const inputCls =
  'rounded-md border border-gray-300 dark:border-gray-600 px-2 py-1 text-sm focus:border-gray-900 dark:focus:border-gray-100 focus:outline-none'
const secondaryBtn =
  'rounded-md border border-gray-300 dark:border-gray-600 px-3 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60'

/** Collapsible "Configuración de este menú" block (RF-12, RF-13). */
export default function MenuSettingsPanel(props: MenuSettingsPanelProps): React.JSX.Element {
  const [open, setOpen] = useState(false)
  return (
    <div className="mb-6 rounded-lg border border-gray-200 dark:border-gray-700">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-2 text-sm font-medium text-gray-800 dark:text-gray-200"
      >
        Configuración de este menú
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <React.Fragment key={props.menu.id}>
          <SettingsForm
            restaurantId={props.restaurantId}
            menu={props.menu}
            onUpdated={props.onUpdated}
            onDeleted={props.onDeleted}
          />
        </React.Fragment>
      )}
    </div>
  )
}

function SettingsForm({ restaurantId, menu, onUpdated, onDeleted }: MenuSettingsPanelProps): React.JSX.Element {
  const [name, setName] = useState(menu.name)
  const [start, setStart] = useState(trimTime(menu.start_time))
  const [end, setEnd] = useState(trimTime(menu.end_time))
  const [days, setDays] = useState<boolean[]>(maskToDays(menu.weekday_mask))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const hasSchedule = menu.start_time !== null || menu.end_time !== null

  async function run(action: () => Promise<void>, fallback: string): Promise<void> {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(menuErrorMessage(err, fallback))
    } finally {
      setBusy(false)
    }
  }

  function handleSave(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    const payload: MenuUpdate = {
      name: name.trim(),
      start_time: start || null,
      end_time: end || null,
      weekday_mask: daysToMask(days),
    }
    void run(async () => onUpdated(await updateMenu(restaurantId, menu.id, payload)), 'No se pudo guardar el menú.')
  }

  function handleMakeDefault(): void {
    void run(
      async () => onUpdated(await updateMenu(restaurantId, menu.id, { is_default: true })),
      'No se pudo marcar el menú como principal.',
    )
  }

  function handleDelete(): void {
    setConfirmingDelete(false)
    void run(async () => {
      await deleteMenu(restaurantId, menu.id)
      onDeleted(menu.id)
    }, 'No se pudo borrar el menú.')
  }

  const n = menu.categories_count

  return (
    <div className="space-y-4 border-t border-gray-200 dark:border-gray-700 px-4 py-4">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="menu-name" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Nombre del menú
            </label>
            <input
              id="menu-name"
              type="text"
              required
              maxLength={120}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${inputCls} w-56`}
            />
          </div>
          <div>
            <label htmlFor="menu-start" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Desde
            </label>
            <input id="menu-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label htmlFor="menu-end" className="mb-1 block text-xs font-medium text-gray-700 dark:text-gray-300">
              Hasta
            </label>
            <input id="menu-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-gray-700 dark:text-gray-300">
            Días (si no elegís ninguno, aplica todos los días)
          </p>
          <div className="flex flex-wrap gap-2">
            {DAYS.map((label, i) => (
              <button
                key={label}
                type="button"
                aria-pressed={days[i]}
                onClick={() => setDays((prev) => prev.map((v, j) => (j === i ? !v : v)))}
                className={
                  days[i]
                    ? 'rounded-full bg-gray-900 dark:bg-gray-100 px-3 py-1 text-xs font-medium text-white dark:text-gray-900'
                    : 'rounded-full border border-gray-300 dark:border-gray-600 px-3 py-1 text-xs font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'
                }
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {hasSchedule && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Los horarios solo se aplican si la programación de menús está activada en el servidor.
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-gray-900 dark:bg-gray-100 px-4 py-1.5 text-sm font-medium text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Guardar cambios
        </button>
      </form>

      <div className="flex flex-wrap items-center gap-3 border-t border-gray-200 dark:border-gray-700 pt-4">
        <button type="button" onClick={handleMakeDefault} disabled={busy || menu.is_default} className={secondaryBtn}>
          Marcar como principal
        </button>

        {confirmingDelete ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-gray-600 dark:text-gray-300">
              Se borrarán {n} {n === 1 ? 'categoría' : 'categorías'} con sus ítems.
            </span>
            {menu.is_default && (
              <span className="text-xs text-gray-600 dark:text-gray-300">
                Es el principal: otro menú pasará a serlo.
              </span>
            )}
            <button
              type="button"
              onClick={handleDelete}
              disabled={busy}
              className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Sí, borrar
            </button>
            <button type="button" onClick={() => setConfirmingDelete(false)} disabled={busy} className={secondaryBtn}>
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={busy}
            className="text-sm font-medium text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Borrar menú
          </button>
        )}
      </div>

      {error && (
        <div role="alert" className="rounded-md bg-red-50 dark:bg-red-950 px-3 py-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  )
}
