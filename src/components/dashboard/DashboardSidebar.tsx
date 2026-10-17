import React from 'react'
import {
  Armchair,
  BarChart3,
  Clock,
  CreditCard,
  Home,
  LayoutGrid,
  LogOut,
  Package,
  Palette,
  Percent,
  ReceiptText,
  Store,
  Truck,
  UserCheck,
  Users2,
  UtensilsCrossed,
} from 'lucide-react'
import type { RestaurantRole } from '../../lib/types'
import type { DashboardSummary } from '../../hooks/useDashboardSummary'
import ThemeToggle from './ThemeToggle'
import { OwnerOnlyNotice, SidebarGroup, SidebarNavItem, SidebarSoonItem } from './SidebarNavItem'

interface DashboardSidebarProps {
  userName: string
  role: RestaurantRole | null
  summary: DashboardSummary
  onLogout: () => void
  /** Mobile drawer state (< md). On md+ the sidebar is always visible. */
  open: boolean
  /** Called after a link is followed, so the drawer can close. */
  onNavigate: () => void
}

function initialsOf(name: string): string {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('')
  return letters || '?'
}

const countBadge =
  'shrink-0 rounded border border-neutral-200 bg-neutral-100 px-1.5 font-mono text-[10px] tabular-nums text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200'
const amberBadge =
  'shrink-0 rounded border border-amber-200 bg-amber-100 px-1.5 font-mono text-[10px] font-medium tabular-nums text-amber-800 dark:border-amber-800/60 dark:bg-amber-950/60 dark:text-amber-300'

export default function DashboardSidebar({
  userName,
  role,
  summary,
  onLogout,
  open,
  onNavigate,
}: DashboardSidebarProps): React.JSX.Element {
  // Without a restaurant yet (role null) nothing is gated: the user must reach
  // the pages that create it.
  const isOwner = role !== 'editor'
  const roleLabel = role === null ? null : role === 'owner' ? 'Administrador' : 'Editor'
  const { pendingOrders, occupiedTables, lowStock, currentShift } = summary

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex h-full w-64 shrink-0 flex-col justify-between border-r border-neutral-200/90 bg-white text-neutral-700 shadow-2xs transition-transform md:static md:z-auto md:translate-x-0 md:visible dark:border-neutral-800 dark:bg-neutral-900 dark:text-neutral-300 ${
        open ? 'translate-x-0' : '-translate-x-full invisible'
      }`}
    >
      <div className="flex min-h-0 flex-col">
        <div className="flex items-center justify-between border-b border-neutral-200/80 bg-neutral-50/50 p-5 dark:border-neutral-800 dark:bg-neutral-950/40">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-amber-500/30 bg-amber-500/15 text-sm font-bold text-amber-700 shadow-2xs dark:text-amber-400">
              GS
            </div>
            <div>
              <span className="block text-sm font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
                GastroSuite
              </span>
              <span className="text-[11px] font-medium tracking-wide text-neutral-500 dark:text-neutral-400">
                Gestión Gastronómica
              </span>
            </div>
          </div>
          <span className="rounded border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] font-medium tracking-wider text-neutral-600 uppercase dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300">
            v{__APP_VERSION__}
          </span>
        </div>

        <div className="min-h-0 space-y-5 overflow-y-auto p-3">
          <SidebarGroup title="Menú digital">
            <SidebarNavItem to="/dashboard" end label="Inicio" icon={Home} onNavigate={onNavigate} />
            <SidebarNavItem to="/dashboard/menu" label="Mi menú" icon={UtensilsCrossed} onNavigate={onNavigate} />
            <SidebarNavItem to="/dashboard/promos" label="Promos" icon={Percent} onNavigate={onNavigate} />
            {isOwner ? (
              <>
                <SidebarNavItem to="/dashboard/appearance" label="Apariencia" icon={Palette} onNavigate={onNavigate} />
                <SidebarNavItem to="/dashboard/info" label="Mi restaurante" icon={Store} onNavigate={onNavigate} />
              </>
            ) : (
              <OwnerOnlyNotice>Configuración exclusiva para administradores.</OwnerOnlyNotice>
            )}
          </SidebarGroup>

          <SidebarGroup
            title="Operación"
            right={
              <span className="font-mono text-[10px] text-neutral-500 dark:text-neutral-400">
                {currentShift ? 'En servicio' : 'Sin turno'}
              </span>
            }
          >
            <SidebarNavItem
              to="/dashboard/tables"
              label="Mesas"
              icon={Armchair}
              onNavigate={onNavigate}
              badge={occupiedTables > 0 ? <span className={countBadge}>{occupiedTables} activas</span> : null}
            />
            <SidebarNavItem
              to="/dashboard/orders"
              label="Comandas"
              icon={ReceiptText}
              onNavigate={onNavigate}
              badge={pendingOrders > 0 ? <span className={amberBadge}>{pendingOrders} pendientes</span> : null}
            />
            <SidebarNavItem to="/dashboard/shifts" label="Turnos" icon={Clock} onNavigate={onNavigate} />
          </SidebarGroup>

          <SidebarGroup title="Gestión">
            <SidebarSoonItem label="Distribución del local" icon={LayoutGrid} />
            <SidebarNavItem
              to="/dashboard/stock"
              label="Stock de mercadería"
              icon={Package}
              warn={lowStock > 0}
              onNavigate={onNavigate}
              badge={
                lowStock > 0 ? (
                  <span
                    className={`${amberBadge} ml-1 flex items-center gap-1`}
                    title={`${lowStock} insumo(s) en o por debajo del umbral mínimo`}
                  >
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" aria-hidden="true" />
                    <span>{lowStock} bajo</span>
                  </span>
                ) : null
              }
            />
            <SidebarNavItem to="/dashboard/suppliers" label="Proveedores" icon={Truck} onNavigate={onNavigate} />
            <SidebarNavItem to="/dashboard/payments" label="Pasarela de pagos" icon={CreditCard} onNavigate={onNavigate} />
            <SidebarNavItem to="/dashboard/staff" label="Usuarios y roles" icon={Users2} onNavigate={onNavigate} />
          </SidebarGroup>

          <SidebarGroup title="Análisis">
            <SidebarSoonItem label="Estadísticas de pedidos" icon={BarChart3} />
          </SidebarGroup>

          <SidebarGroup title="Perfil">
            <SidebarSoonItem label="Perfil y turno" icon={UserCheck} />
            <button
              type="button"
              onClick={onLogout}
              className="group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-red-600 transition-colors hover:bg-red-50 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-950/40 dark:hover:text-red-300"
            >
              <LogOut className="h-4 w-4 text-red-500 transition-colors group-hover:text-red-600 dark:text-red-400" aria-hidden="true" />
              <span className="truncate">Cerrar sesión</span>
            </button>
          </SidebarGroup>
        </div>
      </div>

      <div className="border-t border-neutral-200/80 bg-neutral-50/70 p-3 dark:border-neutral-800 dark:bg-neutral-950/40">
        <div className="flex items-center gap-2.5 rounded-xl border border-neutral-200/90 bg-white p-2 shadow-2xs dark:border-neutral-800 dark:bg-neutral-900">
          <div
            aria-hidden="true"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-neutral-100 text-[10px] font-semibold text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300"
          >
            {initialsOf(userName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-neutral-900 dark:text-neutral-100">{userName}</p>
            {roleLabel && <p className="truncate text-[10px] text-neutral-500 dark:text-neutral-400">{roleLabel}</p>}
          </div>
        </div>
        <ThemeToggle />
      </div>
    </aside>
  )
}
