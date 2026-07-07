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
        <Route path="/menu/:qrToken" element={<PublicMenuPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
