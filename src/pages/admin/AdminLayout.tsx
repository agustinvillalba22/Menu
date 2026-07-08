import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

const linkBase =
  'block rounded-md px-3 py-2 text-sm font-medium transition-colors'

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? `${linkBase} bg-gray-900 text-white`
    : `${linkBase} text-gray-700 hover:bg-gray-100`
}

export default function AdminLayout(): React.JSX.Element {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout(): Promise<void> {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:flex-row sm:px-6 sm:py-10">
        <aside className="w-full shrink-0 sm:w-56">
          <div className="rounded-xl bg-white p-4 shadow-sm">
            <p className="mb-4 px-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
              {user?.full_name ?? 'Administración'}
            </p>
            <nav className="space-y-1">
              <NavLink to="/admin/users" className={navLinkClass}>
                Usuarios
              </NavLink>
              <NavLink to="/admin/restaurants" className={navLinkClass}>
                Restaurantes
              </NavLink>
            </nav>
            {/* RF-07: /admin is a separate section, not a replacement for the
                owner dashboard — a simple link keeps both reachable. */}
            <NavLink
              to="/dashboard"
              className="mt-4 block px-3 text-xs font-medium text-gray-500 hover:text-gray-900 hover:underline"
            >
              Ir a mi dashboard
            </NavLink>
            <button
              type="button"
              onClick={handleLogout}
              className="mt-6 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              Cerrar sesión
            </button>
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
