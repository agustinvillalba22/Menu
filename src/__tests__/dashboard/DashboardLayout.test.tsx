import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DashboardLayout from '../../pages/dashboard/DashboardLayout'
import { AuthContext, type AuthContextValue } from '../../contexts/AuthContext'
import type { Restaurant } from '../../lib/types'
import { jsonResponse } from '../helpers'

global.fetch = vi.fn()
beforeEach(() => vi.clearAllMocks())

const authValue: AuthContextValue = {
  user: {
    id: '1',
    email: 'test@example.com',
    full_name: 'Test',
    is_active: true,
    is_superadmin: false,
    created_at: '2026-01-01T00:00:00Z',
  },
  loading: false,
  isAuthenticated: true,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}

const restaurant: Restaurant = {
  id: 'r1',
  name: 'Boulette',
  slug: 'boulette',
  qr_token: 'qr-abc',
  orders_enabled: false,
  role: 'owner',
}

function renderLayout() {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardLayout />
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('DashboardLayout sidebar', () => {
  // CA-14 (legacy): a "Menú" NavLink to /dashboard/menu sits between
  // "Mi restaurante" and "Apariencia".
  it('renders the Menú link pointing at /dashboard/menu', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([restaurant]))
    renderLayout()
    await screen.findByText('Administrador')

    const menuLink = screen.getByRole('link', { name: 'Menú' })
    expect(menuLink).toHaveAttribute('href', '/dashboard/menu')
  })

  it('orders the nav links: Mi restaurante → Menú → Apariencia', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([restaurant]))
    renderLayout()
    await screen.findByText('Administrador')

    const names = screen
      .getAllByRole('link')
      .map((a) => a.textContent?.trim())
      .filter((t) => ['Mi restaurante', 'Menú', 'Apariencia'].includes(t ?? ''))

    expect(names).toEqual(['Mi restaurante', 'Menú', 'Apariencia'])
  })

  // M15 CA-01: the sidebar is grouped under "Menú digital" / "Configuración",
  // and every link that exists today keeps navigating to the same route.
  it('groups the nav under "Menú digital" and "Configuración"', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([restaurant]))
    renderLayout()
    await screen.findByText('Administrador')

    expect(screen.getByText('Menú digital')).toBeInTheDocument()
    expect(screen.getByText('Configuración')).toBeInTheDocument()

    const expected: Array<[string, string]> = [
      ['Mi restaurante', '/dashboard'],
      ['Menú', '/dashboard/menu'],
      ['Pedidos', '/dashboard/orders'],
      ['Mesas', '/dashboard/tables'],
      ['Promos', '/dashboard/promos'],
      ['Información', '/dashboard/info'],
      ['Apariencia', '/dashboard/appearance'],
      ['Equipo', '/dashboard/staff'],
      ['Stock', '/dashboard/stock'],
      ['Caja', '/dashboard/shifts'],
    ]
    for (const [label, href] of expected) {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href)
    }
  })

  // M15 CA-02: the user block shows "Administrador" for an owner.
  it('shows "Administrador" under the user name for an owner', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([restaurant]))
    renderLayout()

    expect(await screen.findByText('Administrador')).toBeInTheDocument()
  })

  // M15 CA-03 (role indicator half): the user block shows "Editor" for an editor.
  it('shows "Editor" under the user name for an editor', async () => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([{ ...restaurant, role: 'editor' }]))
    renderLayout()

    expect(await screen.findByText('Editor')).toBeInTheDocument()
  })
})

function mockMatchMedia(matches: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }))
}

describe('DashboardLayout dark mode (M16)', () => {
  beforeEach(() => {
    vi.mocked(fetch).mockResolvedValue(jsonResponse([restaurant]))
  })

  // M16 CA-01: no stored preference + OS in light mode → no `.dark` class.
  it('does not apply dark mode when the OS prefers light and nothing is stored', async () => {
    mockMatchMedia(false)
    renderLayout()
    await screen.findByText('Administrador')

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  // M16 CA-02: no stored preference + OS in dark mode → `.dark` class applied.
  it('applies dark mode when the OS prefers dark and nothing is stored', async () => {
    mockMatchMedia(true)
    renderLayout()
    await screen.findByText('Administrador')

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  // M16 CA-03: clicking "Oscuro" applies the class and persists the choice,
  // regardless of the OS preference.
  it('applies and persists dark mode when "Oscuro" is clicked', async () => {
    mockMatchMedia(false)
    renderLayout()
    await screen.findByText('Administrador')

    await userEvent.click(screen.getByRole('button', { name: 'Oscuro' }))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(window.localStorage.getItem('menu_dashboard_theme')).toBe('dark')
  })

  // M16 CA-04: a stored "dark" preference wins over the OS preference.
  it('honors a stored dark preference over the OS light preference', async () => {
    mockMatchMedia(false)
    window.localStorage.setItem('menu_dashboard_theme', 'dark')
    renderLayout()
    await screen.findByText('Administrador')

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  // M16 CA-05: clicking "Sistema" clears the stored preference and follows the OS again.
  it('clears the stored preference when "Sistema" is clicked', async () => {
    mockMatchMedia(true)
    window.localStorage.setItem('menu_dashboard_theme', 'light')
    renderLayout()
    await screen.findByText('Administrador')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    await userEvent.click(screen.getByRole('button', { name: 'Sistema' }))

    expect(window.localStorage.getItem('menu_dashboard_theme')).toBeNull()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})
