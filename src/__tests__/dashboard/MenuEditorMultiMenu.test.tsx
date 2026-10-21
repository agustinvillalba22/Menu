import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import MenuEditorPage from '../../pages/dashboard/MenuEditorPage'
import * as menus from '../../lib/menus'
import { ApiError } from '../../lib/api'
import type { Category, Menu, Restaurant } from '../../lib/types'
import { jsonResponse, routeFetch } from '../helpers'

vi.mock('../../lib/menus')

global.fetch = vi.fn()

const restaurant: Restaurant = {
  id: 'r1',
  name: 'Boulette',
  slug: 'boulette',
  qr_token: 'qr-abc',
  orders_enabled: false,
  role: 'owner',
}

function menu(over: Partial<Menu> & { id: string; name: string }): Menu {
  return {
    is_default: false,
    start_time: null,
    end_time: null,
    weekday_mask: null,
    categories_count: 0,
    ...over,
  }
}

const cena = menu({ id: 'm1', name: 'Cena', is_default: true, categories_count: 3 })
const almuerzo = menu({ id: 'm2', name: 'Almuerzo', categories_count: 2 })

const entradas: Category = { id: 'c1', name: 'Entradas', type: 'food', icon: null }
const postres: Category = { id: 'c2', name: 'Postres', type: 'food', icon: null }

beforeEach(() => {
  vi.resetAllMocks()
  try {
    sessionStorage.clear()
  } catch {
    /* ignore */
  }
  routeFetch([
    { method: 'GET', match: '/subcategories', response: jsonResponse([]) },
    { method: 'GET', match: '/restaurants', response: jsonResponse([restaurant]) },
  ])
  vi.mocked(menus.listMenus).mockResolvedValue([almuerzo, cena])
  vi.mocked(menus.listCategoriesForMenu).mockImplementation(async (_r, menuId) =>
    menuId === 'm1' ? [entradas] : [postres],
  )
})

async function openSettings() {
  await userEvent.click(await screen.findByRole('button', { name: /configuración de este menú/i }))
}

describe('MenuEditorPage — tabs (RF-11, CA-11)', () => {
  it('renders one tab per menu with the default marked "Principal"', async () => {
    render(<MenuEditorPage />)
    const tabs = await screen.findAllByRole('tab')
    expect(tabs).toHaveLength(2)
    expect(within(screen.getByRole('tab', { name: /cena/i })).getByText(/principal/i)).toBeInTheDocument()
    expect(within(screen.getByRole('tab', { name: /almuerzo/i })).queryByText(/principal/i)).toBeNull()
    expect(screen.getByRole('button', { name: /\+ nuevo menú/i })).toBeInTheDocument()
  })

  it('selects the default menu first and loads its categories', async () => {
    render(<MenuEditorPage />)
    expect(await screen.findByText('Entradas')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /cena/i })).toHaveAttribute('aria-selected', 'true')
    expect(menus.listCategoriesForMenu).toHaveBeenCalledWith('r1', 'm1')
  })

  it('switching tab reloads the categories of that menu', async () => {
    render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    await userEvent.click(screen.getByRole('tab', { name: /almuerzo/i }))
    expect(await screen.findByText('Postres')).toBeInTheDocument()
    await waitFor(() => expect(screen.queryByText('Entradas')).not.toBeInTheDocument())
    expect(menus.listCategoriesForMenu).toHaveBeenCalledWith('r1', 'm2')
  })

  it('creates a category through the v2 route of the active tab', async () => {
    vi.mocked(menus.createCategoryForMenu).mockResolvedValue({
      id: 'c9',
      name: 'Brunch',
      type: 'food',
      icon: null,
    })
    render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    await userEvent.click(screen.getByRole('tab', { name: /almuerzo/i }))
    await screen.findByText('Postres')
    await userEvent.type(screen.getByLabelText(/nueva categoría/i), 'Brunch')
    await userEvent.click(screen.getByRole('button', { name: /agregar categoría/i }))
    expect(await screen.findByText('Brunch')).toBeInTheDocument()
    expect(menus.createCategoryForMenu).toHaveBeenCalledWith('r1', 'm2', { name: 'Brunch', type: 'food' })
  })

  it('remembers the active tab in sessionStorage and restores it', async () => {
    const first = render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    await userEvent.click(screen.getByRole('tab', { name: /almuerzo/i }))
    await screen.findByText('Postres')
    expect(sessionStorage.getItem('menu-editor-active-menu:r1')).toBe('m2')
    first.unmount()

    render(<MenuEditorPage />)
    expect(await screen.findByText('Postres')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: /almuerzo/i })).toHaveAttribute('aria-selected', 'true')
  })

  it('falls back to the default menu when the stored id no longer exists, and survives broken storage', async () => {
    sessionStorage.setItem('menu-editor-active-menu:r1', 'gone')
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    render(<MenuEditorPage />)
    expect(await screen.findByText('Entradas')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /almuerzo/i }))
    expect(await screen.findByText('Postres')).toBeInTheDocument()
    spy.mockRestore()
  })

  it('with a single menu shows a single tab and the same editor', async () => {
    vi.mocked(menus.listMenus).mockResolvedValue([cena])
    render(<MenuEditorPage />)
    expect(await screen.findByText('Entradas')).toBeInTheDocument()
    expect(screen.getAllByRole('tab')).toHaveLength(1)
    expect(screen.getByLabelText(/nueva categoría/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /agregar categoría/i })).toBeInTheDocument()
  })

  it('shows an error when menus cannot be loaded', async () => {
    vi.mocked(menus.listMenus).mockRejectedValue(new ApiError(500, 'boom'))
    render(<MenuEditorPage />)
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se pudieron cargar los menús/i)
  })
})

describe('MenuEditorPage — new menu (CA-12)', () => {
  it('creates a menu from "+ Nuevo menú" and selects its tab', async () => {
    const brunch = menu({ id: 'm3', name: 'Brunch' })
    vi.mocked(menus.createMenu).mockResolvedValue(brunch)
    vi.mocked(menus.listCategoriesForMenu).mockImplementation(async (_r, id) =>
      id === 'm1' ? [entradas] : [],
    )
    render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    await userEvent.click(screen.getByRole('button', { name: /\+ nuevo menú/i }))
    await userEvent.type(screen.getByLabelText(/nombre del nuevo menú/i), 'Brunch')
    await userEvent.click(screen.getByRole('button', { name: /crear menú/i }))

    expect(menus.createMenu).toHaveBeenCalledWith('r1', { name: 'Brunch' })
    const tab = await screen.findByRole('tab', { name: /brunch/i })
    expect(tab).toHaveAttribute('aria-selected', 'true')
    await waitFor(() => expect(menus.listCategoriesForMenu).toHaveBeenCalledWith('r1', 'm3'))
  })

  it('maps menu_name_taken to a Spanish message', async () => {
    vi.mocked(menus.createMenu).mockRejectedValue(new ApiError(409, 'menu_name_taken'))
    render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    await userEvent.click(screen.getByRole('button', { name: /\+ nuevo menú/i }))
    await userEvent.type(screen.getByLabelText(/nombre del nuevo menú/i), 'Cena')
    await userEvent.click(screen.getByRole('button', { name: /crear menú/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/ya existe un menú con ese nombre/i)
  })
})

describe('MenuEditorPage — settings panel (RF-12, RF-13)', () => {
  it('is collapsed by default and expands with the menu values', async () => {
    render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    expect(screen.queryByLabelText(/^nombre del menú$/i)).not.toBeInTheDocument()
    await openSettings()
    expect(screen.getByLabelText(/^nombre del menú$/i)).toHaveValue('Cena')
  })

  it('saves name, schedule and weekdays as weekday_mask (bit i = day i)', async () => {
    vi.mocked(menus.updateMenu).mockResolvedValue(
      menu({ id: 'm1', name: 'Cena 2', is_default: true, start_time: '20:00:00', end_time: '23:30:00', weekday_mask: 0b1100001 }),
    )
    render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    await openSettings()
    const name = screen.getByLabelText(/^nombre del menú$/i)
    await userEvent.clear(name)
    await userEvent.type(name, 'Cena 2')
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '20:00' } })
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '23:30' } })
    await userEvent.click(screen.getByRole('button', { name: /^lun$/i })) // bit 0 = 1
    await userEvent.click(screen.getByRole('button', { name: /^sáb$/i })) // bit 5 = 32
    await userEvent.click(screen.getByRole('button', { name: /^dom$/i })) // bit 6 = 64
    expect(screen.getByRole('button', { name: /^lun$/i })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))

    await waitFor(() =>
      expect(menus.updateMenu).toHaveBeenCalledWith('r1', 'm1', {
        name: 'Cena 2',
        start_time: '20:00',
        end_time: '23:30',
        weekday_mask: 97,
      }),
    )
    expect(await screen.findByRole('tab', { name: /cena 2/i })).toBeInTheDocument()
  })

  it('sends weekday_mask null when no day is selected and clears the schedule when empty', async () => {
    const scheduled = menu({
      id: 'm1', name: 'Cena', is_default: true, start_time: '20:00:00', end_time: '23:00:00', weekday_mask: 3,
    })
    vi.mocked(menus.listMenus).mockResolvedValue([scheduled])
    vi.mocked(menus.updateMenu).mockResolvedValue(menu({ id: 'm1', name: 'Cena', is_default: true }))
    render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    await openSettings()
    expect(screen.getByLabelText(/desde/i)).toHaveValue('20:00')
    expect(screen.getByRole('button', { name: /^lun$/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /^mar$/i })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: /^lun$/i }))
    await userEvent.click(screen.getByRole('button', { name: /^mar$/i }))
    fireEvent.change(screen.getByLabelText(/desde/i), { target: { value: '' } })
    fireEvent.change(screen.getByLabelText(/hasta/i), { target: { value: '' } })
    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))
    await waitFor(() =>
      expect(menus.updateMenu).toHaveBeenCalledWith('r1', 'm1', {
        name: 'Cena',
        start_time: null,
        end_time: null,
        weekday_mask: null,
      }),
    )
  })

  it('shows the server-scheduling notice only when the menu has a schedule', async () => {
    const scheduled = menu({ id: 'm1', name: 'Cena', is_default: true, start_time: '20:00:00', end_time: '23:00:00' })
    vi.mocked(menus.listMenus).mockResolvedValue([scheduled, almuerzo])
    render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    await openSettings()
    expect(
      screen.getByText(/los horarios solo se aplican si la programación de menús está activada en el servidor/i),
    ).toBeInTheDocument()
    await userEvent.click(screen.getByRole('tab', { name: /almuerzo/i }))
    await screen.findByText('Postres')
    expect(screen.queryByText(/los horarios solo se aplican/i)).not.toBeInTheDocument()
  })

  it.each([
    ['menu_name_taken', /ya existe un menú con ese nombre/i],
    ['incomplete_schedule', /completá la hora de inicio y la de fin/i],
    ['invalid_schedule', /no pueden ser iguales/i],
  ])('maps %s on save to Spanish', async (code, msg) => {
    vi.mocked(menus.updateMenu).mockRejectedValue(new ApiError(code === 'menu_name_taken' ? 409 : 422, code))
    render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    await openSettings()
    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(msg)
  })

  it('marks a menu as principal, and disables the button when it already is', async () => {
    vi.mocked(menus.updateMenu).mockResolvedValue({ ...almuerzo, is_default: true })
    render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    await openSettings()
    expect(screen.getByRole('button', { name: /marcar como principal/i })).toBeDisabled()

    await userEvent.click(screen.getByRole('tab', { name: /almuerzo/i }))
    await screen.findByText('Postres')
    await userEvent.click(screen.getByRole('button', { name: /marcar como principal/i }))
    await waitFor(() => expect(menus.updateMenu).toHaveBeenCalledWith('r1', 'm2', { is_default: true }))
    // Exactly one tab is marked Principal afterwards.
    await waitFor(() => {
      expect(within(screen.getByRole('tab', { name: /almuerzo/i })).getByText(/principal/i)).toBeInTheDocument()
      expect(within(screen.getByRole('tab', { name: /cena/i })).queryByText(/principal/i)).toBeNull()
    })
    expect(screen.getByRole('button', { name: /marcar como principal/i })).toBeDisabled()
  })

  it('maps cannot_unset_default to Spanish', async () => {
    vi.mocked(menus.updateMenu).mockRejectedValue(new ApiError(409, 'cannot_unset_default'))
    render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    await openSettings()
    await userEvent.click(screen.getByRole('button', { name: /guardar cambios/i }))
    // Generic save error path also handles the code if the server returns it.
    expect(await screen.findByRole('alert')).toHaveTextContent(/siempre tiene que haber un menú principal/i)
  })
})

describe('MenuEditorPage — delete menu (RF-12)', () => {
  it('asks for confirmation showing categories_count, then deletes and selects another tab', async () => {
    vi.mocked(menus.deleteMenu).mockResolvedValue(undefined)
    render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    await userEvent.click(screen.getByRole('tab', { name: /almuerzo/i }))
    await screen.findByText('Postres')
    await openSettings()
    await userEvent.click(screen.getByRole('button', { name: /borrar menú/i }))

    expect(menus.deleteMenu).not.toHaveBeenCalled()
    expect(screen.getByText(/se borrarán 2 categorías con sus ítems/i)).toBeInTheDocument()
    expect(screen.queryByText(/pasará a serlo/i)).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /sí, borrar/i }))
    await waitFor(() => expect(menus.deleteMenu).toHaveBeenCalledWith('r1', 'm2'))
    await waitFor(() => expect(screen.queryByRole('tab', { name: /almuerzo/i })).not.toBeInTheDocument())
    expect(await screen.findByText('Entradas')).toBeInTheDocument()
  })

  it('warns that another menu becomes principal when deleting the principal one', async () => {
    render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    await openSettings()
    await userEvent.click(screen.getByRole('button', { name: /borrar menú/i }))
    expect(screen.getByText(/se borrarán 3 categorías con sus ítems/i)).toBeInTheDocument()
    expect(screen.getByText(/es el principal.*otro menú pasará a serlo/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /cancelar/i }))
    expect(menus.deleteMenu).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: /borrar menú/i })).toBeInTheDocument()
  })

  it('maps cannot_delete_last_menu to Spanish', async () => {
    vi.mocked(menus.listMenus).mockResolvedValue([cena])
    vi.mocked(menus.deleteMenu).mockRejectedValue(new ApiError(409, 'cannot_delete_last_menu'))
    render(<MenuEditorPage />)
    await screen.findByText('Entradas')
    await openSettings()
    await userEvent.click(screen.getByRole('button', { name: /borrar menú/i }))
    await userEvent.click(screen.getByRole('button', { name: /sí, borrar/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/no se puede borrar el único menú/i)
    expect(screen.getByRole('tab', { name: /cena/i })).toBeInTheDocument()
  })
})
