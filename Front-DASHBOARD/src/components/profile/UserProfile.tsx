import React, { useState } from 'react';
import { User } from '../../types';
import {
  UserCheck,
  Clock,
  Shield,
  Armchair,
  LogOut,
  CheckCircle2,
  Calendar,
  Sparkles,
  KeyRound
} from 'lucide-react';

interface UserProfileProps {
  user: User;
  onToggleShift: () => void;
  onLogout: () => void;
  onSwitchUser: () => void;
}

export const UserProfile: React.FC<UserProfileProps> = ({
  user,
  onToggleShift,
  onLogout,
  onSwitchUser,
}) => {
  const [pinChangeNotice, setPinChangeNotice] = useState(false);

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Perfil de Usuario & Turno Activo
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Registro de fichaje al ingresar al turno de servicio, mesas a cargo y seguridad de acceso.
          </p>
        </div>

        <button
          type="button"
          onClick={onLogout}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors border border-red-200"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Cerrar Sesión</span>
        </button>
      </div>

      {/* Main Profile Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* User Card (1 col) */}
        <div className="bg-white p-5 rounded-xl border border-neutral-200 flex flex-col items-center text-center space-y-3">
          <img
            src={user.avatarUrl}
            alt={user.name}
            referrerPolicy="no-referrer"
            className="w-24 h-24 rounded-full object-cover border-2 border-neutral-200 shadow-xs"
          />
          <div>
            <h3 className="font-bold text-neutral-900 text-base">{user.name}</h3>
            <p className="text-xs text-neutral-500 font-medium mt-0.5">
              {user.position}
            </p>
            <p className="text-[11px] text-neutral-400 font-mono mt-0.5">
              {user.email}
            </p>
          </div>

          <div className="w-full pt-3 border-t border-neutral-100">
            <span
              className={`inline-block px-2.5 py-1 text-xs font-semibold rounded-md ${
                user.role === 'superadmin'
                  ? 'bg-neutral-900 text-white'
                  : 'bg-amber-100 text-amber-900'
              }`}
            >
              Rol: {user.role === 'superadmin' ? 'Super Administrador' : 'Empleado Operativo'}
            </span>
          </div>

          <button
            type="button"
            onClick={onSwitchUser}
            className="w-full text-xs text-neutral-600 hover:text-neutral-900 bg-neutral-100 hover:bg-neutral-200/80 py-2 rounded-lg font-medium transition-colors"
          >
            Cambiar de cuenta de prueba
          </button>
        </div>

        {/* Shift Clock-in & Assigned Duties (2 cols) */}
        <div className="md:col-span-2 space-y-5">
          {/* Shift Clock-in Box */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-neutral-500" />
                <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                  Fichaje de Turno
                </h4>
              </div>
              <span
                className={`text-[11px] font-semibold px-2 py-0.5 rounded flex items-center gap-1 ${
                  user.shiftActive
                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full ${
                    user.shiftActive ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'
                  }`}
                />
                {user.shiftActive ? 'Turno en Curso' : 'Fuera de Turno'}
              </span>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-neutral-500">
                  {user.shiftActive
                    ? `Fichado iniciado a las ${user.shiftStartTime || '19:00 hs'}`
                    : 'Ficha tu ingreso al comenzar tu turno en salón, barra o cocina.'}
                </p>
                {user.shiftActive && (
                  <p className="text-xs font-bold text-neutral-900 mt-1 font-mono">
                    Tiempo de servicio: {user.shiftStartTime?.includes('(') ? user.shiftStartTime.split('(')[1]?.replace(')', '') : '3h 30m'}
                  </p>
                )}
              </div>

              <button
                type="button"
                onClick={onToggleShift}
                className={`px-4 py-2 text-xs font-semibold rounded-lg transition-colors shadow-xs ${
                  user.shiftActive
                    ? 'bg-red-600 hover:bg-red-700 text-white'
                    : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                }`}
              >
                {user.shiftActive ? 'Finalizar Turno' : 'Iniciar Turno Ahora'}
              </button>
            </div>
          </div>

          {/* Assigned Tables */}
          {user.tablesAssigned && user.tablesAssigned.length > 0 && (
            <div className="bg-white p-5 rounded-xl border border-neutral-200 space-y-3">
              <div className="flex items-center gap-2 pb-2 border-b border-neutral-100">
                <Armchair className="w-4 h-4 text-neutral-500" />
                <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                  Mesas Asignadas para tu Servicio
                </h4>
              </div>

              <div className="flex items-center gap-2">
                {user.tablesAssigned.map((num) => (
                  <div
                    key={num}
                    className="w-14 h-14 rounded-xl border border-neutral-200 bg-neutral-50 flex flex-col items-center justify-center"
                  >
                    <span className="text-[10px] text-neutral-400 font-mono">Mesa</span>
                    <span className="text-base font-bold font-mono text-neutral-900">
                      #{num}
                    </span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] text-neutral-400">
                Las órdenes solicitadas en estas mesas ingresarán con tu nombre en la comanda.
              </p>
            </div>
          )}

          {/* Quick PIN Security */}
          <div className="bg-white p-5 rounded-xl border border-neutral-200 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-neutral-500" />
                <h4 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                  PIN de Acceso Rápido al Terminal
                </h4>
              </div>
              <span className="text-xs font-mono font-bold text-neutral-800 tracking-widest">
                •••• ({user.pin || '1234'})
              </span>
            </div>
            <p className="text-[11px] text-neutral-500">
              Utiliza este PIN de 4 dígitos para desbloquear terminales rápidas de comandas en salón sin escribir tu contraseña completa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
