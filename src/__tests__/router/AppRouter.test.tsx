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
