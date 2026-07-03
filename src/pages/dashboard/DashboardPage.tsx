import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'

export default function DashboardPage(): React.JSX.Element {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  async function handleLogout(): Promise<void> {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-50 px-6 py-10">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-semibold text-gray-900">
          Hola, {user?.full_name ?? 'usuario'}
        </h1>
        <p className="mt-2 text-sm text-gray-600">
          Bienvenido a tu panel. Acá vas a gestionar tu menú.
        </p>

        <button
          type="button"
          onClick={handleLogout}
          className="mt-6 rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
