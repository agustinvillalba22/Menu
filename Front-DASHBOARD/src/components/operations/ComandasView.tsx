import React, { useState } from 'react';
import {
  Order,
  OrderChannel,
  OrderStatus,
} from '../../types';
import {
  Clock,
  AlertCircle,
  CheckCircle2,
  Armchair,
  ShoppingBag,
  Truck,
  ChefHat,
  Filter,
  Check,
  Flame,
  ArrowRight
} from 'lucide-react';

interface ComandasViewProps {
  orders: Order[];
  onUpdateOrderStatus: (orderId: string, newStatus: OrderStatus) => void;
}

export const ComandasView: React.FC<ComandasViewProps> = ({
  orders,
  onUpdateOrderStatus,
}) => {
  const [selectedChannel, setSelectedChannel] = useState<'all' | OrderChannel>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');

  // Filter only pending / in preparation unless 'all' is selected
  const nonConcludedOrders = orders.filter((o) =>
    statusFilter === 'active' ? o.status !== 'entregado' : true
  );

  // Filter by channel
  const channelFilteredOrders = nonConcludedOrders.filter(
    (o) => selectedChannel === 'all' || o.channel === selectedChannel
  );

  // Sort by priority and elapsed time (longest waiting orders first!)
  const sortedOrders = [...channelFilteredOrders].sort(
    (a, b) => b.elapsedMinutes - a.elapsedMinutes
  );

  const getChannelIcon = (channel: OrderChannel) => {
    switch (channel) {
      case 'mesa':
        return <Armchair className="w-3.5 h-3.5 text-neutral-600" />;
      case 'takeaway':
        return <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />;
      case 'delivery':
        return <Truck className="w-3.5 h-3.5 text-blue-600" />;
    }
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pendiente':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
            Pendiente de Cocina
          </span>
        );
      case 'preparacion':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
            <ChefHat className="w-3 h-3" /> En Preparación
          </span>
        );
      case 'listo':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Listo para Servir
          </span>
        );
      case 'entregado':
        return (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-neutral-100 text-neutral-600 border border-neutral-200">
            Concluido
          </span>
        );
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Comandas & Kitchen Display System (KDS)
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Pedidos no concluidos organizados por orden estricto de tiempo de solicitud y canal.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-neutral-200 p-0.5 bg-neutral-100 text-xs">
            <button
              type="button"
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white shadow-xs font-semibold text-neutral-900'
                  : 'text-neutral-500'
              }`}
            >
              En Curso ({orders.filter((o) => o.status !== 'entregado').length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white shadow-xs font-semibold text-neutral-900'
                  : 'text-neutral-500'
              }`}
            >
              Historial Completo
            </button>
          </div>
        </div>
      </div>

      {/* Channel Segmented Filters */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedChannel('all')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
            selectedChannel === 'all'
              ? 'bg-neutral-900 text-white'
              : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          <span>Todos los Pedidos</span>
          <span className="text-[10px] opacity-75 font-mono">
            ({nonConcludedOrders.length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedChannel('mesa')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
            selectedChannel === 'mesa'
              ? 'bg-neutral-900 text-white'
              : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          <Armchair className="w-3.5 h-3.5" />
          <span>Mesas del Salón</span>
          <span className="text-[10px] opacity-75 font-mono">
            ({nonConcludedOrders.filter((o) => o.channel === 'mesa').length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedChannel('takeaway')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
            selectedChannel === 'takeaway'
              ? 'bg-neutral-900 text-white'
              : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          <ShoppingBag className="w-3.5 h-3.5 text-amber-500" />
          <span>Para Llevar (Take Away)</span>
          <span className="text-[10px] opacity-75 font-mono">
            ({nonConcludedOrders.filter((o) => o.channel === 'takeaway').length})
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedChannel('delivery')}
          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1.5 ${
            selectedChannel === 'delivery'
              ? 'bg-neutral-900 text-white'
              : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
          }`}
        >
          <Truck className="w-3.5 h-3.5 text-blue-500" />
          <span>Delivery</span>
          <span className="text-[10px] opacity-75 font-mono">
            ({nonConcludedOrders.filter((o) => o.channel === 'delivery').length})
          </span>
        </button>
      </div>

      {/* Orders Grid (Sorted by Wait Time Priority) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedOrders.map((order) => {
          const isUrgent = order.elapsedMinutes >= 20;
          const isDelayed = order.elapsedMinutes >= 15;

          return (
            <div
              key={order.id}
              className={`bg-white rounded-xl border flex flex-col justify-between overflow-hidden shadow-xs transition-all ${
                isUrgent
                  ? 'border-red-300 ring-1 ring-red-200'
                  : isDelayed
                  ? 'border-amber-300'
                  : 'border-neutral-200'
              }`}
            >
              {/* Ticket Header */}
              <div
                className={`p-3.5 border-b flex items-start justify-between ${
                  isUrgent
                    ? 'bg-red-50/50 border-red-100'
                    : isDelayed
                    ? 'bg-amber-50/40 border-amber-100'
                    : 'bg-neutral-50/60 border-neutral-100'
                }`}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-sm text-neutral-900">
                      {order.code}
                    </span>
                    <span className="flex items-center gap-1 text-xs text-neutral-600 font-medium">
                      {getChannelIcon(order.channel)}
                      {order.channel === 'mesa' && `Mesa ${order.tableNumber}`}
                      {order.channel === 'takeaway' && `Retiro: ${order.customerName}`}
                      {order.channel === 'delivery' && `Delivery: ${order.customerName}`}
                    </span>
                  </div>

                  {order.deliveryAddress && (
                    <p className="text-[11px] text-neutral-500 font-mono mt-0.5 truncate max-w-[220px]">
                      {order.deliveryAddress}
                    </p>
                  )}
                  {order.courierNotes && (
                    <p className="text-[10px] text-blue-700 mt-0.5">
                      {order.courierNotes}
                    </p>
                  )}
                </div>

                {/* Priority / Elapsed Time Clock */}
                <div
                  className={`flex items-center gap-1 font-mono text-xs px-2 py-0.5 rounded font-bold tabular-nums ${
                    isUrgent
                      ? 'bg-red-600 text-white'
                      : isDelayed
                      ? 'bg-amber-500 text-white'
                      : 'bg-neutral-200 text-neutral-700'
                  }`}
                  title="Tiempo transcurrido desde la solicitud"
                >
                  <Clock className="w-3 h-3" />
                  <span>{order.elapsedMinutes} min</span>
                </div>
              </div>

              {/* Items in ticket */}
              <div className="p-4 flex-1 space-y-2.5">
                <div className="divide-y divide-neutral-100">
                  {order.items.map((item, idx) => (
                    <div key={idx} className="py-2 first:pt-0 last:pb-0">
                      <div className="flex items-start justify-between text-xs">
                        <span className="font-bold text-neutral-900">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="font-mono text-neutral-500 tabular-nums">
                          ${(item.quantity * item.unitPrice).toLocaleString('es-AR')}
                        </span>
                      </div>
                      {item.notes && (
                        <p className="text-[11px] text-amber-800 font-medium italic mt-0.5 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200/50">
                          Nota: {item.notes}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Actions & Status Progression */}
              <div className="p-3 bg-neutral-50/70 border-t border-neutral-100 flex items-center justify-between gap-2">
                <div>{getStatusBadge(order.status)}</div>

                <div className="flex items-center gap-1.5">
                  {order.status === 'pendiente' && (
                    <button
                      type="button"
                      onClick={() => onUpdateOrderStatus(order.id, 'preparacion')}
                      className="px-2.5 py-1 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                    >
                      Empezar
                    </button>
                  )}

                  {order.status === 'preparacion' && (
                    <button
                      type="button"
                      onClick={() => onUpdateOrderStatus(order.id, 'listo')}
                      className="px-2.5 py-1 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors"
                    >
                      Listo
                    </button>
                  )}

                  {order.status === 'listo' && (
                    <button
                      type="button"
                      onClick={() => onUpdateOrderStatus(order.id, 'entregado')}
                      className="px-2.5 py-1 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-md transition-colors"
                    >
                      Despachar
                    </button>
                  )}

                  {order.status === 'entregado' && (
                    <span className="text-[11px] text-neutral-400 font-mono">
                      Finalizado
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {sortedOrders.length === 0 && (
          <div className="col-span-full py-16 text-center bg-white rounded-xl border border-neutral-200">
            <CheckCircle2 className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <h4 className="text-sm font-semibold text-neutral-800">
              No hay comandas pendientes
            </h4>
            <p className="text-xs text-neutral-500 mt-1">
              Todos los pedidos del salón, retiro y delivery se encuentran concluidos y despachados.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
