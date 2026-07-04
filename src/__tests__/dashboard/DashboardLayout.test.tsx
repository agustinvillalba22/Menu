import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import DashboardLayout from '../../pages/dashboard/DashboardLayout'
import { AuthContext, type AuthContextValue } from '../../contexts/AuthContext'

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
  // CA-14: a "Menú" NavLink to /dashboard/menu sits between
  // "Mi restaurante" and "Apariencia".
  it('renders the Menú link pointing at /dashboard/menu', () => {
    renderLayout()

    const menuLink = screen.getByRole('link', { name: 'Menú' })
    expect(menuLink).toHaveAttribute('href', '/dashboard/menu')
  })

  it('orders the nav links: Mi restaurante → Menú → Apariencia', () => {
    renderLayout()

    const names = screen
      .getAllByRole('link')
      .map((a) => a.textContent?.trim())
      .filter((t) => ['Mi restaurante', 'Menú', 'Apariencia'].includes(t ?? ''))

    expect(names).toEqual(['Mi restaurante', 'Menú', 'Apariencia'])
  })
})
