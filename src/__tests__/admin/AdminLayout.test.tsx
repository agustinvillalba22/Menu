import { describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import AdminLayout from '../../pages/admin/AdminLayout'
import { AuthContext, type AuthContextValue } from '../../contexts/AuthContext'

const authValue: AuthContextValue = {
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

function renderLayout(initialEntry: string, indexElement: ReactNode) {
  return render(
    <AuthContext.Provider value={authValue}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={indexElement} />
            <Route path="users" element={<div>Users view</div>} />
            <Route path="restaurants" element={<div>Restaurants view</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </AuthContext.Provider>,
  )
}

describe('AdminLayout', () => {
  it('renders navigation links to Usuarios and Restaurantes', () => {
    renderLayout('/admin/users', <div>Users view</div>)

    const usersLink = screen.getByRole('link', { name: /usuarios/i })
    const restaurantsLink = screen.getByRole('link', { name: /restaurantes/i })
    expect(usersLink).toHaveAttribute('href', '/admin/users')
    expect(restaurantsLink).toHaveAttribute('href', '/admin/restaurants')
  })

  it('renders the child route content', () => {
    renderLayout('/admin/restaurants', <div>Users view</div>)
    expect(screen.getByText('Restaurants view')).toBeInTheDocument()
  })
})
