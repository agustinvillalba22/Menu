import React, { useState } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useMyRestaurant } from '../../hooks/useMyRestaurant'
import { useDashboardSummary } from '../../hooks/useDashboardSummary'
import DashboardSidebar from '../../components/dashboard/DashboardSidebar'
import DashboardTopBar from '../../components/dashboard/DashboardTopBar'
import StockAlertToast from '../../components/dashboard/StockAlertToast'

// M32: shell faithful to the GastroSuite prototype — full-height sidebar on the
// left, sticky top bar and a scrollable <main> on the right. Below `md` the
// sidebar becomes a drawer opened from the top bar.
export default function DashboardLayout(): React.JSX.Element {
  const { user, logout } = useAuth()
  const { restaurant } = useMyRestaurant()
  const navigate = useNavigate()
  const [navOpen, setNavOpen] = useState(false)
  const summary = useDashboardSummary(restaurant?.id ?? null, restaurant?.orders_enabled ?? true)

  async function handleLogout(): Promise<void> {
    await logout()
    navigate('/login')
  }

  const roleLabel = restaurant ? (restaurant.role === 'owner' ? 'Administrador' : 'Editor') : null

  return (
    <div className="dashboard-root font-jakarta flex h-screen w-screen overflow-hidden bg-neutral-100/80 text-neutral-900 antialiased dark:bg-neutral-950 dark:text-neutral-100">
      {navOpen && (
        <button
          type="button"
          aria-label="Cerrar menú de navegación"
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-30 bg-neutral-900/40 md:hidden"
        />
      )}
      <DashboardSidebar
        userName={user?.full_name ?? 'Mi panel'}
        role={restaurant?.role ?? null}
        summary={summary}
        onLogout={handleLogout}
        open={navOpen}
        onNavigate={() => setNavOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <DashboardTopBar
          restaurant={restaurant}
          currentShift={summary.currentShift}
          roleLabel={roleLabel}
          onOpenNav={() => setNavOpen(true)}
        />
        <main className="min-h-0 flex-1 overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          <Outlet />
        </main>
      </div>

      <StockAlertToast items={restaurant ? summary.lowStockItems : []} />
    </div>
  )
}
