import React from 'react';
import {
  Store,
  UtensilsCrossed,
  Palette,
  LayoutGrid,
  BarChart3,
  Package,
  CreditCard,
  Users2,
  Armchair,
  ReceiptText,
  UserCheck,
  LogOut,
  ShieldAlert,
  ChevronRight,
  Clock,
  Truck
} from 'lucide-react';
import { User } from '../types';

export type NavTab =
  | 'menu'
  | 'appearance'
  | 'restaurant'
  | 'tables'
  | 'orders'
  | 'shifts'
  | 'floorplan'
  | 'stock'
  | 'suppliers'
  | 'payments'
  | 'team'
  | 'analytics'
  | 'profile';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentUser: User;
  pendingOrdersCount: number;
  occupiedTablesCount: number;
  lowStockCount?: number;
  onLogout: () => void;
  onSwitchUser: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  currentUser,
  pendingOrdersCount,
  occupiedTablesCount,
  lowStockCount = 0,
  onLogout,
  onSwitchUser,
}) => {
  const isSuperAdmin = currentUser.role === 'superadmin';

  return (
    <aside className="w-64 shrink-0 bg-white text-neutral-700 flex flex-col justify-between border-r border-neutral-200/90 min-h-screen shadow-2xs">
      {/* Top Brand Block */}
      <div className="flex flex-col">
        <div className="p-5 border-b border-neutral-200/80 bg-neutral-50/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-700 font-bold text-sm shadow-2xs">
              GS
            </div>
            <div>
              <span className="font-bold text-sm text-neutral-900 tracking-tight block">
                GastroSuite
              </span>
              <span className="text-[11px] text-neutral-500 tracking-wide font-medium">
                Gestión Gastronómica
              </span>
            </div>
          </div>
          <span className="text-[10px] px-1.5 py-0.5 rounded border border-neutral-200 bg-neutral-100 text-neutral-600 uppercase tracking-wider font-mono font-medium">
            v2.4
          </span>
        </div>

        {/* Navigation Sections */}
        <div className="p-3 space-y-5 overflow-y-auto max-h-[calc(100vh-190px)]">
          {/* GROUP 1: MENÚ DIGITAL */}
          <div>
            <div className="px-3 pb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                Menú Digital
              </span>
              {!isSuperAdmin && (
                <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1" title="Requiere rol de Administrador">
                  <ShieldAlert className="w-3 h-3" />
                  Restringido
                </span>
              )}
            </div>

            {isSuperAdmin ? (
              <nav className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => onSelectTab('menu')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors group ${
                    currentTab === 'menu'
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
                  }`}
                >
                  <UtensilsCrossed className={`w-4 h-4 transition-colors ${currentTab === 'menu' ? 'text-amber-400' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                  <span className="truncate">Mi menú</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab('appearance')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors group ${
                    currentTab === 'appearance'
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
                  }`}
                >
                  <Palette className={`w-4 h-4 transition-colors ${currentTab === 'appearance' ? 'text-amber-400' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                  <span className="truncate">Apariencia</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab('restaurant')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors group ${
                    currentTab === 'restaurant'
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
                  }`}
                >
                  <Store className={`w-4 h-4 transition-colors ${currentTab === 'restaurant' ? 'text-amber-400' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                  <span className="truncate">Mi restaurante</span>
                </button>
              </nav>
            ) : (
              <div className="px-3 py-2 bg-amber-50/70 rounded-lg border border-amber-200/80 text-[10px] text-amber-900 leading-snug">
                Configuración exclusiva para administradores.
              </div>
            )}
          </div>

          {/* GROUP 2: OPERACIÓN */}
          <div>
            <div className="px-3 pb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                Operación
              </span>
              <span className="text-[10px] text-neutral-500 font-mono">
                En servicio
              </span>
            </div>

            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectTab('tables')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors group ${
                  currentTab === 'tables'
                    ? 'bg-neutral-900 text-white font-medium shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Armchair className={`w-4 h-4 transition-colors ${currentTab === 'tables' ? 'text-amber-400' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                  <span className="truncate">Mesas</span>
                </div>
                {occupiedTablesCount > 0 && (
                  <span
                    className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded ${
                      currentTab === 'tables'
                        ? 'bg-neutral-800 text-neutral-200 border border-neutral-700'
                        : 'bg-neutral-100 border border-neutral-200 text-neutral-700'
                    }`}
                  >
                    {occupiedTablesCount} activas
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('orders')}
                className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors group ${
                  currentTab === 'orders'
                    ? 'bg-neutral-900 text-white font-medium shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <ReceiptText className={`w-4 h-4 transition-colors ${currentTab === 'orders' ? 'text-amber-400' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                  <span className="truncate">Comandas</span>
                </div>
                {pendingOrdersCount > 0 && (
                  <span
                    className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded font-medium ${
                      currentTab === 'orders'
                        ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                        : 'bg-amber-100 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {pendingOrdersCount} pendientes
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => onSelectTab('shifts')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors group ${
                  currentTab === 'shifts'
                    ? 'bg-neutral-900 text-white font-medium shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
                }`}
              >
                <Clock className={`w-4 h-4 transition-colors ${currentTab === 'shifts' ? 'text-amber-400' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                <span className="truncate">Turnos</span>
              </button>
            </nav>
          </div>

          {/* GROUP 3: GESTIÓN */}
          <div>
            <div className="px-3 pb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                Gestión
              </span>
              {!isSuperAdmin && (
                <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  Admin
                </span>
              )}
            </div>

            {isSuperAdmin ? (
              <nav className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => onSelectTab('floorplan')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors group ${
                    currentTab === 'floorplan'
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
                  }`}
                >
                  <LayoutGrid className={`w-4 h-4 transition-colors ${currentTab === 'floorplan' ? 'text-amber-400' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                  <span className="truncate">Distribución del local</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab('stock')}
                  className={`w-full flex items-center justify-between px-3 py-2 text-xs rounded-lg transition-colors group ${
                    currentTab === 'stock'
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Package
                      className={`w-4 h-4 shrink-0 transition-colors ${
                        currentTab === 'stock'
                          ? 'text-amber-400'
                          : lowStockCount > 0
                          ? 'text-amber-600'
                          : 'text-neutral-400 group-hover:text-neutral-600'
                      }`}
                    />
                    <span className="truncate">Stock de mercadería</span>
                  </div>
                  {lowStockCount > 0 && (
                    <span
                      className={`text-[10px] font-mono tabular-nums px-1.5 py-0.2 rounded font-medium flex items-center gap-1 shrink-0 ml-1 ${
                        currentTab === 'stock'
                          ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30'
                          : 'bg-amber-100 text-amber-800 border border-amber-200'
                      }`}
                      title={`${lowStockCount} insumo(s) en o por debajo del umbral mínimo`}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                      <span>{lowStockCount} bajo</span>
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab('suppliers')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors group ${
                    currentTab === 'suppliers'
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
                  }`}
                >
                  <Truck className={`w-4 h-4 transition-colors ${currentTab === 'suppliers' ? 'text-amber-400' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                  <span className="truncate">Proveedores</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab('payments')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors group ${
                    currentTab === 'payments'
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
                  }`}
                >
                  <CreditCard className={`w-4 h-4 transition-colors ${currentTab === 'payments' ? 'text-amber-400' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                  <span className="truncate">Pasarela de pagos</span>
                </button>

                <button
                  type="button"
                  onClick={() => onSelectTab('team')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors group ${
                    currentTab === 'team'
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
                  }`}
                >
                  <Users2 className={`w-4 h-4 transition-colors ${currentTab === 'team' ? 'text-amber-400' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                  <span className="truncate">Usuarios y roles</span>
                </button>
              </nav>
            ) : (
              <div className="px-3 py-2 bg-amber-50/70 rounded-lg border border-amber-200/80 text-[10px] text-amber-900 leading-snug">
                Módulo reservado para gestión administrativa.
              </div>
            )}
          </div>

          {/* GROUP 4: ANÁLISIS */}
          <div>
            <div className="px-3 pb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                Análisis
              </span>
              {!isSuperAdmin && (
                <span className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                  <ShieldAlert className="w-3 h-3" />
                  Admin
                </span>
              )}
            </div>

            {isSuperAdmin ? (
              <nav className="space-y-0.5">
                <button
                  type="button"
                  onClick={() => onSelectTab('analytics')}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors group ${
                    currentTab === 'analytics'
                      ? 'bg-neutral-900 text-white font-medium shadow-xs'
                      : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
                  }`}
                >
                  <BarChart3 className={`w-4 h-4 transition-colors ${currentTab === 'analytics' ? 'text-amber-400' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                  <span className="truncate">Estadísticas de pedidos</span>
                </button>
              </nav>
            ) : (
              <div className="px-3 py-2 bg-amber-50/70 rounded-lg border border-amber-200/80 text-[10px] text-amber-900 leading-snug">
                Reportes y métricas comerciales para administradores.
              </div>
            )}
          </div>

          {/* GROUP 5: PERFIL */}
          <div>
            <div className="px-3 pb-2">
              <span className="text-[11px] font-bold tracking-wider text-neutral-400 uppercase">
                Perfil
              </span>
            </div>

            <nav className="space-y-0.5">
              <button
                type="button"
                onClick={() => onSelectTab('profile')}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg transition-colors group ${
                  currentTab === 'profile'
                    ? 'bg-neutral-900 text-white font-medium shadow-xs'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
                }`}
              >
                <UserCheck className={`w-4 h-4 transition-colors ${currentTab === 'profile' ? 'text-amber-400' : 'text-neutral-400 group-hover:text-neutral-600'}`} />
                <span className="truncate">Perfil y turno</span>
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="w-full flex items-center gap-2.5 px-3 py-2 text-xs rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50 transition-colors group"
              >
                <LogOut className="w-4 h-4 text-red-500 group-hover:text-red-600 transition-colors" />
                <span className="truncate">Cerrar sesión</span>
              </button>
            </nav>
          </div>
        </div>
      </div>

      {/* Footer User Box & Fast Role Toggle */}
      <div className="p-3 border-t border-neutral-200/80 bg-neutral-50/70">
        <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-neutral-200/90 shadow-2xs">
          <div className="flex items-center gap-2.5 min-w-0">
            <img
              src={currentUser.avatarUrl}
              alt={currentUser.name}
              referrerPolicy="no-referrer"
              className="w-7 h-7 rounded-full object-cover border border-neutral-200 shrink-0"
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
              }}
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-neutral-900 truncate">
                {currentUser.name}
              </p>
              <p className="text-[10px] text-neutral-500 truncate">
                {currentUser.position}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onSwitchUser}
            title="Cambiar entre Superadmin y Mozo Operativo"
            className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
