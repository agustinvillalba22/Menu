import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import AppRouter from '../../router'
import { AuthContext, type AuthContextValue } from '../../contexts/AuthContext'

function makeAuth(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null,
    loading: false,
    isAuthenticated: false,
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    ...overrides,
  }
}

const ownerAuth = makeAuth({
  user: {
    id: '2',
    email: 'owner@example.com',
    full_name: 'Owner',
    is_active: true,
    is_superadmin: false,
    created_at: '2026-01-01T00:00:00Z',
  },
  isAuthenticated: true,
})

global.fetch = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  // Dashboard/login pages may fetch on mount; keep pending so the test only
  // asserts on routing.
  vi.mocked(fetch).mockImplementation(() => new Promise(() => {}))
})

function renderAt(path: string, auth: AuthContextValue) {
  window.history.pushState({}, '', path)
  render(
    <AuthContext.Provider value={auth}>
      <AppRouter />
    </AuthContext.Provider>,
  )
}

describe('AppRouter root route (M22 RF-05)', () => {
  it('redirects / to /dashboard when authenticated', () => {
    renderAt('/', ownerAuth)
    expect(window.location.pathname).toBe('/dashboard')
  })

  it('redirects / to /login when not authenticated', () => {
    renderAt('/', makeAuth({}))
    expect(window.location.pathname).toBe('/login')
  })

  it('shows Cargando… on / while auth is loading and does not redirect', () => {
    renderAt('/', makeAuth({ loading: true }))
    expect(screen.getByText('Cargando…')).toBeInTheDocument()
    expect(window.location.pathname).toBe('/')
  })

  it('redirects an unknown route to /dashboard when authenticated', () => {
    renderAt('/xyz', ownerAuth)
    expect(window.location.pathname).toBe('/dashboard')
  })

  it('redirects an unknown route to /login when not authenticated', () => {
    renderAt('/xyz', makeAuth({}))
    expect(window.location.pathname).toBe('/login')
  })
})
