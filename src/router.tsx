import React from 'react'
import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import App from './App'
import { useAuth } from './hooks/useAuth'
import LoginPage from './pages/auth/LoginPage'
import RegisterPage from './pages/auth/RegisterPage'
import DashboardLayout from './pages/dashboard/DashboardLayout'
import OverviewPage from './pages/dashboard/OverviewPage'
import AppearancePage from './pages/dashboard/AppearancePage'
import MenuEditorPage from './pages/dashboard/MenuEditorPage'
import OrdersPage from './pages/dashboard/OrdersPage'
import PublicMenuPage from './pages/public/PublicMenuPage'
import AdminLayout from './pages/admin/AdminLayout'
import AdminUsersPage from './pages/admin/AdminUsersPage'
import AdminRestaurantsPage from './pages/admin/AdminRestaurantsPage'

function PrivateRoute({ children }: { children: ReactNode }): React.JSX.Element {
  const { loading, isAuthenticated } = useAuth()
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Cargando…</div>
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  return <>{children}</>
}

// RF-03: gates /admin on `is_superadmin`. Distinct from `PrivateRoute` because
// the "authenticated but unauthorized" case redirects to "/" (not "/login") —
// the user does have a session, they just lack the permission.
export function SuperadminRoute({ children }: { children: ReactNode }): React.JSX.Element {
  const { loading, isAuthenticated, user } = useAuth()
  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-600">Cargando…</div>
  }
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (!user?.is_superadmin) {
    return <Navigate to="/" replace />
  }
  return <>{children}</>
}

export default function AppRouter(): React.JSX.Element {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route
          path="/dashboard"
          element={
            <PrivateRoute>
              <DashboardLayout />
            </PrivateRoute>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="menu" element={<MenuEditorPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="appearance" element={<AppearancePage />} />
        </Route>
        <Route
          path="/admin"
          element={
            <SuperadminRoute>
              <AdminLayout />
            </SuperadminRoute>
          }
        >
          <Route index element={<Navigate to="/admin/users" replace />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="restaurants" element={<AdminRestaurantsPage />} />
        </Route>
        <Route path="/menu/:qrToken" element={<PublicMenuPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
