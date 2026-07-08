import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { SuperadminRoute } from '../../router'
import { AuthContext, type AuthContextValue } from '../../contexts/AuthContext'
import type { User } from '../../lib/types'

function baseUser(overrides: Partial<User> = {}): User {
  return {
    id: '1',
    email: 'user@example.com',
    full_name: 'Test User',
    is_active: true,
    is_superadmin: false,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function renderWithAuth(authValue: AuthContextValue) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route path="/login" element={<div>Login page</div>} />
          <Route path="/" element={<div>Home page</div>} />
          <Route
            path="/admin"
            element={
              <SuperadminRoute>
                <div>Admin content</div>
              </SuperadminRoute>
            }
          />
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('SuperadminRoute', () => {
  // CA-01: authenticated but non-superadmin user visiting /admin is
  // redirected to "/" and never sees the admin UI.
  it('redirects a non-superadmin authenticated user to "/"', () => {
    renderWithAuth({
      user: baseUser({ is_superadmin: false }),
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    })

    expect(screen.getByText('Home page')).toBeInTheDocument()
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
  })

  it('redirects an unauthenticated user to "/login"', () => {
    renderWithAuth({
      user: null,
      loading: false,
      isAuthenticated: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    })

    expect(screen.getByText('Login page')).toBeInTheDocument()
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
  })

  // CA-02 (route-guard half): a superadmin sees the protected content.
  it('renders the protected content for a superadmin user', () => {
    renderWithAuth({
      user: baseUser({ is_superadmin: true }),
      loading: false,
      isAuthenticated: true,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    })

    expect(screen.getByText('Admin content')).toBeInTheDocument()
  })

  it('shows a loading state while auth is resolving, without redirecting', () => {
    renderWithAuth({
      user: null,
      loading: true,
      isAuthenticated: false,
      login: vi.fn(),
      register: vi.fn(),
      logout: vi.fn(),
    })

    expect(screen.queryByText('Login page')).not.toBeInTheDocument()
    expect(screen.queryByText('Home page')).not.toBeInTheDocument()
    expect(screen.queryByText('Admin content')).not.toBeInTheDocument()
  })
})
