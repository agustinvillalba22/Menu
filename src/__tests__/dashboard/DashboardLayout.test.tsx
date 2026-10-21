import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import DashboardLayout from '../../pages/dashboard/DashboardLayout'
import { AuthContext, type AuthContextValue } from '../../contexts/AuthContext'
import type { Restaurant } from '../../lib/types'
import { orderFixture, stockFixture } from './fixtures'
import { jsonResponse, routeFetch } from '../helpers'

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

function mockApi(r: Restaurant = restaurant, extra: Array<{ match: string; body: unknown }> = []): void {
  routeFetch([
    ...extra.map((e) => ({ match: e.match, response: jsonResponse(e.body) })),
    { match: '/shifts/current', response: jsonResponse(null) },
    { match: '/stock-items', response: jsonResponse([]) },
    { match: '/orders', response: jsonResponse([]) },
    { match: '/restaurants', response: jsonResponse([r]) },
  ])
}

describe('DashboardLayout shell (M32)', () => {
  it('renders sidebar, top bar and main with the outlet area', async () => {
    mockApi()
    renderLayout()
    await screen.findAllByText('Administrador')

    expect(screen.getByRole('complementary')).toBeInTheDocument()
    expect(screen.getByRole('banner')).toBeInTheDocument()
    expect(screen.getByRole('main')).toBeInTheDocument()
  })

  it('shows the restaurant name and menu link in the top bar', async () => {
    mockApi()
    renderLayout()

    expect(await screen.findByRole('link', { name: /Ver Menú Cliente/ })).toHaveAttribute('href', '/menu/qr-abc')
  })

  it('shows "Administrador" under the user name for an owner', async () => {
    mockApi()
    renderLayout()
    expect((await screen.findAllByText('Administrador')).length).toBeGreaterThan(0)
  })

  it('shows "Editor" and the owner-only notice for an editor', async () => {
    mockApi({ ...restaurant, role: 'editor' })
    renderLayout()

    expect((await screen.findAllByText('Editor')).length).toBeGreaterThan(0)
    expect(screen.getByText('Configuración exclusiva para administradores.')).toBeInTheDocument()
  })

  it('shows sidebar badges from the summary data', async () => {
    mockApi({ ...restaurant, orders_enabled: true }, [
      { match: 'status=pending', body: [orderFixture({ id: 'a', table_id: 't1' })] },
      {
        match: '/stock-items',
        body: [stockFixture({ id: 's1', quantity: '0', min_threshold: '1' })],
      },
    ])
    renderLayout()

    expect(await screen.findByText('1 pendientes')).toBeInTheDocument()
    expect(screen.getByText('1 activas')).toBeInTheDocument()
    expect(screen.getByText('1 bajo')).toBeInTheDocument()
  })

  it('shows the stock alert toast when there are low-stock items', async () => {
    mockApi(restaurant, [
      { match: '/stock-items', body: [stockFixture({ id: 's1', quantity: '0', min_threshold: '1' })] },
    ])
    renderLayout()

    expect(await screen.findByText('Alerta de Stock Mínimo')).toBeInTheDocument()
  })

  it('does not show the toast without low stock', async () => {
    mockApi()
    renderLayout()
    await screen.findByRole('link', { name: /Ver Menú Cliente/ })

    expect(screen.queryByText('Alerta de Stock Mínimo')).not.toBeInTheDocument()
  })

  it('still renders the layout when the summary requests fail', async () => {
    routeFetch([
      { match: '/shifts/current', response: jsonResponse({ detail: 'x' }, 500) },
      { match: '/stock-items', response: jsonResponse({ detail: 'x' }, 500) },
      { match: '/orders', response: jsonResponse({ detail: 'x' }, 500) },
      { match: '/restaurants', response: jsonResponse([restaurant]) },
    ])
    renderLayout()

    expect(await screen.findByRole('link', { name: /Ver Menú Cliente/ })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Mi menú' })).toBeInTheDocument()
  })

  it('opens the nav drawer on small screens and closes it after navigating', async () => {
    mockApi()
    renderLayout()
    await screen.findByRole('link', { name: /Ver Menú Cliente/ })
    expect(screen.queryByRole('button', { name: 'Cerrar menú de navegación' })).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Abrir menú de navegación' }))
    expect(screen.getByRole('button', { name: 'Cerrar menú de navegación' })).toBeInTheDocument()

    await userEvent.click(screen.getByRole('link', { name: 'Promos' }))
    expect(screen.queryByRole('button', { name: 'Cerrar menú de navegación' })).not.toBeInTheDocument()
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
    mockApi()
  })

  // M16 CA-01: no stored preference + OS in light mode → no `.dark` class.
  it('does not apply dark mode when the OS prefers light and nothing is stored', async () => {
    mockMatchMedia(false)
    renderLayout()
    await screen.findAllByText('Administrador')

    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  // M16 CA-02: no stored preference + OS in dark mode → `.dark` class applied.
  it('applies dark mode when the OS prefers dark and nothing is stored', async () => {
    mockMatchMedia(true)
    renderLayout()
    await screen.findAllByText('Administrador')

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  // M16 CA-03: clicking "Oscuro" applies the class and persists the choice,
  // regardless of the OS preference.
  it('applies and persists dark mode when "Oscuro" is clicked', async () => {
    mockMatchMedia(false)
    renderLayout()
    await screen.findAllByText('Administrador')

    await userEvent.click(screen.getByRole('button', { name: 'Oscuro' }))

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(window.localStorage.getItem('menu_dashboard_theme')).toBe('dark')
  })

  // M16 CA-04: a stored "dark" preference wins over the OS preference.
  it('honors a stored dark preference over the OS light preference', async () => {
    mockMatchMedia(false)
    window.localStorage.setItem('menu_dashboard_theme', 'dark')
    renderLayout()
    await screen.findAllByText('Administrador')

    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  // M16 CA-05: clicking "Sistema" clears the stored preference and follows the OS again.
  it('clears the stored preference when "Sistema" is clicked', async () => {
    mockMatchMedia(true)
    window.localStorage.setItem('menu_dashboard_theme', 'light')
    renderLayout()
    await screen.findAllByText('Administrador')
    expect(document.documentElement.classList.contains('dark')).toBe(false)

    await userEvent.click(screen.getByRole('button', { name: 'Sistema' }))

    expect(window.localStorage.getItem('menu_dashboard_theme')).toBeNull()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })
})

describe('DashboardLayout dark mode form controls (M31)', () => {
  it('marks the root container with the dashboard-root class', async () => {
    mockApi()
    const { container } = renderLayout()
    await screen.findAllByText('Administrador')

    expect(container.firstElementChild).toHaveClass('dashboard-root')
  })
})
