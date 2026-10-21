import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AppRouter from '../../router'
import { AuthContext, type AuthContextValue } from '../../contexts/AuthContext'

const superadminAuth: AuthContextValue = {
  user: {
    id: '1',
    email: 'admin@example.com',
    full_name: 'Admin',
    is_active: true,
    is_superadmin: true,
    created_at: '2026-01-01T00:00:00Z',
  },
  loading: false,
  isAuthenticated: true,
  login: vi.fn(),
  register: vi.fn(),
  logout: vi.fn(),
}

global.fetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  // AdminUsersPage/AdminRestaurantsPage fetch on mount; keep them pending
  // forever so this test only asserts on routing, not on fetched data.
  vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
})

describe('AppRouter /admin default route', () => {
  // CA-02: a superadmin visiting /admin lands on /admin/users by default.
  it('redirects /admin to /admin/users for a superadmin', async () => {
    window.history.pushState({}, '', '/admin')

    render(
      <AuthContext.Provider value={superadminAuth}>
        <AppRouter />
      </AuthContext.Provider>,
    )

    expect(window.location.pathname).toBe('/admin/users')
    // AdminUsersPage is mounted (shows its loading state, since fetch never
    // resolves here) — confirms the redirect landed on the users view.
    expect(await screen.findByText(/cargando/i)).toBeInTheDocument()
  })
})

describe('AppRouter /dashboard/payments', () => {
  it('renders the payments page under the dashboard layout', async () => {
    window.history.pushState({}, '', '/dashboard/payments')
    const json = (body: unknown) =>
      Promise.resolve(new Response(JSON.stringify(body), { status: 200 }))
    vi.mocked(fetch).mockImplementation((input) => {
      const url = String(input)
      if (url.endsWith('/payments/mercadopago')) {
        return json({ configured: true, connected: false, status: null, mp_user_id: null })
      }
      if (url.endsWith('/restaurants')) {
        return json([
          { id: 'r1', name: 'Boulette', slug: 'boulette', qr_token: 'q', orders_enabled: true, role: 'owner' },
        ])
      }
      return new Promise(() => {})
    })

    render(
      <AuthContext.Provider value={superadminAuth}>
        <AppRouter />
      </AuthContext.Provider>,
    )

    expect(
      await screen.findByRole('heading', { name: /pasarela de pagos/i }),
    ).toBeInTheDocument()
  })
})
