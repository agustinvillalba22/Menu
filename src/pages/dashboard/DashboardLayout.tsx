import React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import {
  Store,
  UtensilsCrossed,
  ReceiptText,
  Armchair,
  Percent,
  Info,
  Palette,
  Users2,
  Package,
  Sun,
  Moon,
  Monitor,
} from 'lucide-react'
import { useAuth } from '../../hooks/useAuth'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import { isOwner } from '../../lib/restaurants'
import { useTheme, type Theme } from '../../hooks/useTheme'

const linkBase =
  'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors'

function navLinkClass({ isActive }: { isActive: boolean }): string {
  return isActive
    ? `${linkBase} bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900`
    : `${linkBase} text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800`
}

interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
}

// M15 RF-01: grouped nav — one group per area of the product, each item
// mapped to a route that already exists today (no new pages).
const MENU_GROUP: NavItem[] = [
  { to: '/dashboard', label: 'Mi restaurante', icon: Store, end: true },
  { to: '/dashboard/menu', label: 'Menú', icon: UtensilsCrossed },
  { to: '/dashboard/orders', label: 'Pedidos', icon: ReceiptText },
  { to: '/dashboard/tables', label: 'Mesas', icon: Armchair },
  { to: '/dashboard/promos', label: 'Promos', icon: Percent },
]

const CONFIG_GROUP: NavItem[] = [
  { to: '/dashboard/info', label: 'Información', icon: Info },
  { to: '/dashboard/appearance', label: 'Apariencia', icon: Palette },
  { to: '/dashboard/staff', label: 'Equipo', icon: Users2 },
  { to: '/dashboard/stock', label: 'Stock', icon: Package },
]

function NavGroup({ title, items }: { title: string; items: NavItem[] }): React.JSX.Element {
  return (
    <div>
      <p className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
        {title}
      </p>
      <nav className="space-y-0.5">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={navLinkClass}>
            <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  )
}

const THEME_OPTIONS: Array<{ value: Theme; label: string; icon: React.ComponentType<{ className?: string }> }> = [
  { value: 'light', label: 'Claro', icon: Sun },
  { value: 'dark', label: 'Oscuro', icon: Moon },
  { value: 'system', label: 'Sistema', icon: Monitor },
]

function ThemeToggle(): React.JSX.Element {
  const { theme, setTheme } = useTheme()

  return (
    <div
      role="group"
      aria-label="Tema del dashboard"
      className="mt-4 grid grid-cols-3 gap-1 rounded-md border border-gray-300 dark:border-gray-600 p-1"
    >
      {THEME_OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = theme === value
        return (
          <button
            key={value}
            type="button"
            aria-pressed={active}
            title={label}
            onClick={() => setTheme(value)}
            className={`flex flex-col items-center gap-0.5 rounded px-1 py-1.5 text-[10px] font-medium transition-colors ${
              active
                ? 'bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            {label}
          </button>
        )
      })}
    </div>
  )
}

export default function DashboardLayout(): React.JSX.Element {
  const { user, logout } = useAuth()
  const { restaurant } = useMyRestaurant()
  const navigate = useNavigate()

  async function handleLogout(): Promise<void> {
    await logout()
    navigate('/login')
  }

  // M15 RF-02: role label under the user's name — derived from the same
  // `restaurant.role` the backend already returns, nothing new to fetch.
  const roleLabel = restaurant ? (isOwner(restaurant) ? 'Administrador' : 'Editor') : null

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:flex-row sm:px-6 sm:py-10">
        <aside className="w-full shrink-0 sm:w-56">
          <div className="rounded-xl bg-white dark:bg-gray-900 p-4 shadow-sm">
            <div className="mb-4 px-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-gray-500">
                {user?.full_name ?? 'Mi panel'}
              </p>
              {roleLabel && <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{roleLabel}</p>}
            </div>

            <div className="space-y-5">
              <NavGroup title="Menú digital" items={MENU_GROUP} />
              <NavGroup title="Configuración" items={CONFIG_GROUP} />
            </div>

            <ThemeToggle />

            <button
              type="button"
              onClick={handleLogout}
              className="mt-6 w-full rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
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
