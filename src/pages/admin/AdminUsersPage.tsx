import React, { useEffect, useState } from 'react'
import { listAdminUsers, updateAdminUser } from '../../lib/admin'
import type { AdminUser } from '../../lib/types'
import Toggle from '../../components/ui/Toggle'

export default function AdminUsersPage(): React.JSX.Element {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [togglingId, setTogglingId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load(): Promise<void> {
      setLoading(true)
      setError(null)
      try {
        const list = await listAdminUsers()
        if (!cancelled) setUsers(list)
      } catch {
        if (!cancelled) setError('No se pudieron cargar los usuarios.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  // CA-03: PATCH only the field being flipped, never re-sending the rest.
  async function handleToggle(user: AdminUser, field: 'is_active' | 'is_superadmin'): Promise<void> {
    setTogglingId(user.id)
    setError(null)
    try {
      const updated = await updateAdminUser(user.id, { [field]: !user[field] })
      setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)))
    } catch {
      setError('No se pudo actualizar el usuario.')
    } finally {
      setTogglingId(null)
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-600">Cargando…</p>
  }

  if (error && users.length === 0) {
    return (
      <div role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
        {error}
      </div>
    )
  }

  return (
    <div className="rounded-xl bg-white p-6 shadow-sm">
      <h1 className="mb-6 text-xl font-semibold text-gray-900">Usuarios</h1>

      {error && (
        <div role="alert" className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {users.length === 0 ? (
        <p className="text-sm text-gray-500">No hay usuarios.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-gray-500">
                <th className="py-2 pr-4 font-medium">Email</th>
                <th className="py-2 pr-4 font-medium">Nombre</th>
                <th className="py-2 pr-4 font-medium">Activo</th>
                <th className="py-2 pr-4 font-medium">Superadmin</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-gray-50">
                  <td className="py-2 pr-4 text-gray-900">{u.email}</td>
                  <td className="py-2 pr-4 text-gray-900">{u.full_name}</td>
                  <td className="py-2 pr-4">
                    <Toggle
                      checked={u.is_active}
                      label={`Activo — ${u.email}`}
                      disabled={togglingId === u.id}
                      onToggle={() => handleToggle(u, 'is_active')}
                    />
                  </td>
                  <td className="py-2 pr-4">
                    <Toggle
                      checked={u.is_superadmin}
                      label={`Superadmin — ${u.email}`}
                      disabled={togglingId === u.id}
                      onToggle={() => handleToggle(u, 'is_superadmin')}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
