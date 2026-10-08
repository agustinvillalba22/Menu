import React from 'react';
import { NavTab } from './Sidebar';
import { User } from '../types';
import { Clock, QrCode, ArrowLeftRight, CheckCircle2 } from 'lucide-react';

interface TopBarProps {
  currentTab: NavTab;
  restaurantName: string;
  currentUser: User;
  onOpenCustomerMenu: () => void;
  onSwitchUserRole: () => void;
  orderReceptionEnabled: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({
  currentTab,
  restaurantName,
  currentUser,
  onOpenCustomerMenu,
  onSwitchUserRole,
  orderReceptionEnabled,
}) => {
  const getTabLabel = (tab: NavTab) => {
    switch (tab) {
      case 'menu':
        return 'Mi menú';
      case 'appearance':
        return 'Apariencia';
      case 'restaurant':
        return 'Mi restaurante';
      case 'tables':
        return 'Mesas';
      case 'orders':
        return 'Comandas';
      case 'shifts':
        return 'Turnos';
      case 'floorplan':
        return 'Distribución del local';
      case 'stock':
        return 'Stock de mercadería';
      case 'suppliers':
        return 'Proveedores';
      case 'payments':
        return 'Pasarela de pagos';
      case 'team':
        return 'Usuarios y roles';
      case 'analytics':
        return 'Estadísticas de pedidos';
      case 'profile':
        return 'Perfil y turno';
      default:
        return 'Panel';
    }
  };

  return (
    <header className="h-14 border-b border-neutral-200 bg-white px-6 flex items-center justify-between sticky top-0 z-20">
      {/* Zone 1: Brand & Context Breadcrumb */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold text-neutral-900 tracking-tight">
          {restaurantName}
        </span>
        <span className="text-neutral-300">/</span>
        <span className="text-xs text-neutral-500 font-medium">
          {getTabLabel(currentTab)}
        </span>
      </div>

      {/* Zone 2: Real Status Text Metadata (Zero-Pill discipline) */}
      <div className="hidden md:flex items-center gap-3 text-xs text-neutral-500">
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-neutral-400" />
          <span className="tabular-nums">Turno: {currentUser.shiftStartTime || '18:00 hs'}</span>
        </div>
        <span aria-hidden="true" className="text-neutral-300">·</span>
        <div className="flex items-center gap-1.5">
          <CheckCircle2
            className={`w-3.5 h-3.5 ${
              orderReceptionEnabled ? 'text-emerald-600' : 'text-neutral-400'
            }`}
          />
          <span>{orderReceptionEnabled ? 'Recepción activa' : 'Pedidos pausados'}</span>
        </div>
        <span aria-hidden="true" className="text-neutral-300">·</span>
        <span className="text-neutral-600 font-medium">
          {currentUser.position}
        </span>
      </div>

      {/* Zone 3: Primary Actions */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSwitchUserRole}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 rounded-md transition-colors"
          title="Alternar entre Super Administrador y Mozo Operativo"
        >
          <ArrowLeftRight className="w-3.5 h-3.5 text-neutral-500" />
          <span>Cambiar a {currentUser.role === 'superadmin' ? 'Mozo' : 'Superadmin'}</span>
        </button>

        <button
          type="button"
          onClick={onOpenCustomerMenu}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors shadow-sm"
        >
          <QrCode className="w-3.5 h-3.5 text-neutral-300" />
          <span>Ver Menú Cliente</span>
        </button>
      </div>
    </header>
  );
};
