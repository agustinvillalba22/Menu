import React, { useState } from 'react';
import { AlertTriangle, Package, X, ArrowRight, Bell } from 'lucide-react';
import { StockItem } from '../../types';

interface StockAlertToastProps {
  lowStockItems: StockItem[];
  onViewStock: () => void;
  onDismiss: () => void;
  isDismissed: boolean;
  onReopen: () => void;
}

export const StockAlertToast: React.FC<StockAlertToastProps> = ({
  lowStockItems,
  onViewStock,
  onDismiss,
  isDismissed,
  onReopen,
}) => {
  if (lowStockItems.length === 0) return null;

  // When dismissed, show a discreet floating indicator pill so the user can easily re-access alerts if needed
  if (isDismissed) {
    return (
      <button
        type="button"
        onClick={onReopen}
        className="fixed bottom-4 right-4 z-40 px-3.5 py-2 bg-white/95 backdrop-blur-xs border border-amber-300 hover:border-amber-400 text-neutral-800 rounded-full shadow-lg shadow-neutral-950/5 flex items-center gap-2 text-xs transition-all hover:scale-105 group"
        title="Ver alerta de productos con stock bajo"
      >
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
        </span>
        <span className="font-semibold text-amber-800">
          {lowStockItems.length} insumos bajo umbral
        </span>
        <Bell className="w-3.5 h-3.5 text-neutral-400 group-hover:text-amber-600 transition-colors" />
      </button>
    );
  }

  const criticalItems = lowStockItems.filter((i) => i.status === 'critico');
  const primaryItem = lowStockItems[0];

  return (
    <div
      role="alert"
      className="fixed bottom-4 right-4 z-40 max-w-sm w-[calc(100vw-2rem)] md:w-96 bg-white/95 backdrop-blur-md border border-amber-200/90 rounded-2xl shadow-2xl shadow-neutral-900/10 p-4 text-neutral-900 animate-in slide-in-from-bottom-5 duration-300"
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0 text-amber-600">
            <AlertTriangle className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
              <span>Alerta de Stock Mínimo</span>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200 font-mono font-medium">
                {lowStockItems.length} {lowStockItems.length === 1 ? 'producto' : 'productos'}
              </span>
            </h3>
            <p className="text-[11px] text-neutral-500">
              {criticalItems.length > 0
                ? `${criticalItems.length} en nivel crítico de reposición`
                : 'Alcanzaron el umbral mínimo de seguridad'}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onDismiss}
          className="text-neutral-400 hover:text-neutral-700 p-1 rounded-lg hover:bg-neutral-100 transition-colors"
          title="Cerrar notificación"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Body: Preview of low stock products */}
      <div className="mt-3 pt-2.5 border-t border-neutral-100 space-y-1.5">
        <p className="text-xs text-neutral-600 leading-snug">
          {lowStockItems.length === 1 ? (
            <>
              El insumo <span className="font-semibold text-amber-900">{primaryItem.name}</span> tiene{' '}
              <span className="font-mono font-medium text-amber-700">{primaryItem.quantity} {primaryItem.unit}</span> (mínimo:{' '}
              <span className="font-mono text-neutral-500">{primaryItem.minThreshold} {primaryItem.unit}</span>).
            </>
          ) : (
            <>
              <span className="font-semibold text-amber-900">{primaryItem.name}</span> y otros{' '}
              <span className="font-semibold text-neutral-900">{lowStockItems.length - 1} insumos</span> necesitan reposición proactiva.
            </>
          )}
        </p>

        {/* Small chips of low stock items */}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {lowStockItems.slice(0, 3).map((item) => (
            <span
              key={item.id}
              className={`text-[10px] px-2 py-0.5 rounded border font-mono flex items-center gap-1 ${
                item.status === 'critico'
                  ? 'bg-red-50 text-red-700 border-red-200 font-medium'
                  : 'bg-amber-50 text-amber-800 border-amber-200 font-medium'
              }`}
            >
              <Package className="w-2.5 h-2.5" />
              <span className="truncate max-w-[120px]">{item.name}</span>: {item.quantity}/{item.minThreshold} {item.unit}
            </span>
          ))}
          {lowStockItems.length > 3 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-neutral-100 border border-neutral-200 text-neutral-600 font-mono">
              +{lowStockItems.length - 3} más
            </span>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div className="mt-3.5 pt-2.5 border-t border-neutral-100 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs font-medium text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg px-2.5 py-1.5 transition-colors"
        >
          Descartar
        </button>

        <button
          type="button"
          onClick={onViewStock}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm"
        >
          <span>Gestionar Stock</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
