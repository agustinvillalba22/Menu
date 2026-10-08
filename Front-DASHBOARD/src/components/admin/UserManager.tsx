import React, { useState } from 'react';
import { User, UserRole, UserPosition } from '../../types';
import {
  Users2,
  Shield,
  ShieldCheck,
  CheckCircle,
  Plus,
  Clock,
  UserCheck,
  Armchair,
  Trash2
} from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';

interface UserManagerProps {
  users: User[];
  currentUserId: string;
  onAddUser: (user: Omit<User, 'id'>) => void;
  onToggleShift: (userId: string) => void;
  onDeleteUser?: (userId: string) => void;
}

export const UserManager: React.FC<UserManagerProps> = ({
  users,
  currentUserId,
  onAddUser,
  onToggleShift,
  onDeleteUser,
}) => {
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [newUserName, setNewUserName] = useState('');
  const [newUserEmail, setNewUserEmail] = useState('');
  const [newUserRole, setNewUserRole] = useState<UserRole>('operativo');
  const [newUserPosition, setNewUserPosition] = useState<UserPosition>('Mozo / Camarero');
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const handleCreateUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserName.trim() || !newUserEmail.trim()) return;

    onAddUser({
      name: newUserName.trim(),
      email: newUserEmail.trim(),
      role: newUserRole,
      position: newUserPosition,
      avatarUrl: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80',
      shiftActive: false,
      pin: '1234',
    });

    setIsAddUserOpen(false);
    setNewUserName('');
    setNewUserEmail('');
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Gestión de Personal, Turnos & Roles
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Administra los niveles de acceso (Super Admin vs Operativo) y registro de fichaje de turnos en salón y cocina.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsAddUserOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo Miembro</span>
        </button>
      </div>

      {/* Permissions Matrix Callout */}
      <div className="bg-white p-5 rounded-xl border border-neutral-200 space-y-3">
        <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-emerald-600" />
          <span>Matriz de Control de Accesos (RBAC)</span>
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-900">
                Super Administrador / Dueño
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-900 text-white font-mono">
                Acceso Total
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Acceso sin restricciones a todas las aristas: Configuración del local, carta de menú, precios, estadísticas financieras, plano del salón, inventario, pasarela de pagos y equipo.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-neutral-50 border border-neutral-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-neutral-900">
                Personal Operativo (Mozos, Barra, Cocina)
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 font-mono">
                Solo Operativo
              </span>
            </div>
            <p className="text-[11px] text-neutral-500 leading-relaxed">
              Acceso focalizado exclusivamente a la sección operativa: Gestión de mesas asignadas, carga de pedidos, visualización y despacho de comandas KDS, y fichaje de inicio/fin de turno.
            </p>
          </div>
        </div>
      </div>

      {/* Staff Members List */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
            Miembros del Establecimiento ({users.length})
          </h3>
          <span className="text-[11px] text-neutral-400 font-mono">
            {users.filter((u) => u.shiftActive).length} en turno actualmente
          </span>
        </div>

        <div className="divide-y divide-neutral-100">
          {users.map((u) => (
            <div
              key={u.id}
              className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-neutral-50/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <img
                  src={u.avatarUrl}
                  alt={u.name}
                  referrerPolicy="no-referrer"
                  className="w-10 h-10 rounded-full object-cover border border-neutral-200 shrink-0"
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h4 className="font-semibold text-xs text-neutral-900">
                      {u.name}
                    </h4>
                    {u.id === currentUserId && (
                      <span className="text-[10px] text-neutral-500 font-mono">
                        (Tú)
                      </span>
                    )}
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded font-medium ${
                        u.role === 'superadmin'
                          ? 'bg-neutral-900 text-white'
                          : 'bg-neutral-100 text-neutral-700'
                      }`}
                    >
                      {u.position}
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
                    {u.email}
                  </p>
                  {u.tablesAssigned && u.tablesAssigned.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-neutral-500 mt-1">
                      <Armchair className="w-3 h-3 text-neutral-400" />
                      <span>Mesas asignadas: {u.tablesAssigned.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-4 self-end sm:self-center">
                <div className="text-right">
                  <div className="flex items-center gap-1.5 text-xs">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        u.shiftActive ? 'bg-emerald-500' : 'bg-neutral-300'
                      }`}
                    />
                    <span className="font-medium text-neutral-800">
                      {u.shiftActive ? 'En Turno' : 'Fuera de Turno'}
                    </span>
                  </div>
                  {u.shiftActive && u.shiftStartTime && (
                    <span className="text-[10px] text-neutral-400 font-mono block">
                      {u.shiftStartTime}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onToggleShift(u.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                    u.shiftActive
                      ? 'text-neutral-700 bg-neutral-100 hover:bg-neutral-200'
                      : 'text-white bg-neutral-900 hover:bg-neutral-800'
                  }`}
                >
                  {u.shiftActive ? 'Cerrar Turno' : 'Iniciar Turno'}
                </button>

                {onDeleteUser && u.id !== currentUserId && (
                  <button
                    type="button"
                    onClick={() => setUserToDelete(u)}
                    className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="Eliminar miembro del equipo"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal: New User */}
      {isAddUserOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-sm overflow-hidden animate-in fade-in duration-150">
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">
                Nuevo Miembro del Equipo
              </h3>
              <button
                type="button"
                onClick={() => setIsAddUserOpen(false)}
                className="text-xs text-neutral-400 hover:text-neutral-600"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Nombre Completo
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Sofía Valenzuela"
                  value={newUserName}
                  onChange={(e) => setNewUserName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Correo Electrónico
                </label>
                <input
                  type="email"
                  required
                  placeholder="sofia@latelier.com"
                  value={newUserEmail}
                  onChange={(e) => setNewUserEmail(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Puesto / Función
                </label>
                <select
                  value={newUserPosition}
                  onChange={(e) => {
                    const pos = e.target.value as UserPosition;
                    setNewUserPosition(pos);
                    if (pos === 'Super Administrador' || pos === 'Gerente General') {
                      setNewUserRole('superadmin');
                    } else {
                      setNewUserRole('operativo');
                    }
                  }}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800"
                >
                  <option value="Mozo / Camarero">Mozo / Camarero</option>
                  <option value="Bartender">Bartender</option>
                  <option value="Jefe de Cocina">Jefe de Cocina</option>
                  <option value="Cajero">Cajero</option>
                  <option value="Gerente General">Gerente General</option>
                  <option value="Super Administrador">Super Administrador</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Nivel de Permisos en Dashboard
                </label>
                <div className="p-2.5 rounded-lg border border-neutral-200 bg-neutral-50 text-xs">
                  <span className="font-semibold text-neutral-800">
                    {newUserRole === 'superadmin' ? 'Super Administrador' : 'Empleado Operativo'}
                  </span>
                  <p className="text-[11px] text-neutral-500 mt-0.5">
                    {newUserRole === 'superadmin'
                      ? 'Acceso total a administración y operaciones.'
                      : 'Acceso restringido a comandas y mesas.'}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsAddUserOpen(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium text-white bg-neutral-900 rounded-md hover:bg-neutral-800"
                >
                  Crear Usuario
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal before deleting team member */}
      <ConfirmModal
        isOpen={!!userToDelete}
        title="¿Estás seguro que quieres eliminar?"
        itemName={userToDelete ? `${userToDelete.name} (${userToDelete.position})` : undefined}
        description="Este empleado será removido del establecimiento y perderá de forma permanente el acceso al dashboard y sus turnos quedarán inactivos."
        confirmText="Sí, eliminar usuario"
        cancelText="Cancelar"
        onConfirm={() => {
          if (userToDelete && onDeleteUser) {
            onDeleteUser(userToDelete.id);
            setUserToDelete(null);
          }
        }}
        onCancel={() => setUserToDelete(null)}
      />
    </div>
  );
};
