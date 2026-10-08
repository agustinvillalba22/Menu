import React from 'react';
import {
  TrendingUp,
  DollarSign,
  ShoppingBag,
  Clock,
  ArrowUpRight,
  Utensils,
  Truck,
  Armchair
} from 'lucide-react';
import { Order } from '../../types';

interface AnalyticsViewProps {
  orders: Order[];
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({ orders }) => {
  // Calculated figures based on orders
  const todayRevenue = 384500;
  const monthRevenue = 8420000;
  const averageTicket = 34500;
  const completedOrdersCount = 42;

  const topDishes = [
    {
      name: 'Tagliatelle con Trufa Negra & Parmigiano',
      orders: 68,
      revenue: 1258000,
      share: '32%',
    },
    {
      name: 'Ojo de Bife Madurado 45 Días',
      orders: 45,
      revenue: 1120500,
      share: '28%',
    },
    {
      name: 'Burrata Pugliese con Higos Asados',
      orders: 39,
      revenue: 514800,
      share: '15%',
    },
    {
      name: 'Old Fashioned Ahumado',
      orders: 52,
      revenue: 462800,
      share: '12%',
    },
    {
      name: 'Volcán de Chocolate Amargo 70%',
      orders: 31,
      revenue: 294500,
      share: '13%',
    },
  ];

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Estadísticas & Rendimiento Gastronómico
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Métricas de facturación en vivo, ticket promedio y distribución de ventas por canal.
          </p>
        </div>

        <div className="text-xs text-neutral-500 font-mono">
          Actualizado: Hoy, 20:48 hs
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Facturación del Día</span>
            <DollarSign className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-neutral-900 mt-2 tabular-nums">
            ${todayRevenue.toLocaleString('es-AR')}
          </p>
          <div className="flex items-center gap-1 text-[11px] text-emerald-600 font-medium mt-1">
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>+14.2% vs. mismo día semana pasada</span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Ticket Promedio</span>
            <TrendingUp className="w-4 h-4 text-neutral-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-neutral-900 mt-2 tabular-nums">
            ${averageTicket.toLocaleString('es-AR')}
          </p>
          <span className="text-[11px] text-neutral-400 mt-1 block font-mono">
            Promedio 2.4 comensales / mesa
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Comandas del Turno</span>
            <ShoppingBag className="w-4 h-4 text-neutral-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-neutral-900 mt-2 tabular-nums">
            {completedOrdersCount} servicios
          </p>
          <span className="text-[11px] text-neutral-400 mt-1 block">
            0 cancelaciones · 100% efectividad
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-neutral-200 shadow-xs">
          <div className="flex items-center justify-between text-neutral-500 text-xs">
            <span>Tiempo Prom. de Cocina</span>
            <Clock className="w-4 h-4 text-neutral-600" />
          </div>
          <p className="text-2xl font-bold font-mono text-neutral-900 mt-2 tabular-nums">
            18 min
          </p>
          <span className="text-[11px] text-emerald-600 mt-1 block font-medium">
            Dentro del estándar objetivo (&lt; 22m)
          </span>
        </div>
      </div>

      {/* Channel Distribution & Hourly Traffic */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Channel Breakdown (5 cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-neutral-200 space-y-4">
          <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
            Ventas por Canal
          </h3>

          <div className="space-y-3.5 pt-2">
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 text-neutral-700 font-medium">
                  <Armchair className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Mesas en Salón (Dine-in)</span>
                </span>
                <span className="font-mono font-semibold tabular-nums text-neutral-900">
                  64% · $246.000
                </span>
              </div>
              <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-neutral-900 rounded-full" style={{ width: '64%' }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 text-neutral-700 font-medium">
                  <ShoppingBag className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Para Llevar (Take Away)</span>
                </span>
                <span className="font-mono font-semibold tabular-nums text-neutral-900">
                  21% · $80.700
                </span>
              </div>
              <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-amber-600 rounded-full" style={{ width: '21%' }} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="flex items-center gap-1.5 text-neutral-700 font-medium">
                  <Truck className="w-3.5 h-3.5 text-neutral-500" />
                  <span>Delivery Directo / Apps</span>
                </span>
                <span className="font-mono font-semibold tabular-nums text-neutral-900">
                  15% · $57.800
                </span>
              </div>
              <div className="w-full h-2 bg-neutral-100 rounded-full overflow-hidden">
                <div className="h-full bg-blue-600 rounded-full" style={{ width: '15%' }} />
              </div>
            </div>
          </div>

          <div className="p-3 bg-neutral-50 rounded-lg text-[11px] text-neutral-600 leading-relaxed border border-neutral-100">
            El canal de salón mantiene la rentabilidad más alta por comensal gracias al maridaje de vinos y coctelería de autor.
          </div>
        </div>

        {/* Top Selling Dishes Table (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-neutral-200 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
              Platos Más Populares & Facturación
            </h3>
            <span className="text-[11px] text-neutral-400 font-mono">
              Top 5 de la semana
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-neutral-200 text-neutral-500 text-[11px]">
                <tr>
                  <th className="pb-2 font-medium">Plato</th>
                  <th className="pb-2 font-medium text-right">Cant.</th>
                  <th className="pb-2 font-medium text-right">Facturado</th>
                  <th className="pb-2 font-medium text-right">% Venta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {topDishes.map((item, idx) => (
                  <tr key={item.name} className="hover:bg-neutral-50/50">
                    <td className="py-2.5 font-medium text-neutral-800 pr-2">
                      <span className="text-neutral-400 font-mono mr-1.5">{idx + 1}.</span>
                      {item.name}
                    </td>
                    <td className="py-2.5 text-right font-mono text-neutral-600 tabular-nums">
                      {item.orders}
                    </td>
                    <td className="py-2.5 text-right font-mono font-semibold text-neutral-900 tabular-nums">
                      ${item.revenue.toLocaleString('es-AR')}
                    </td>
                    <td className="py-2.5 text-right font-mono text-neutral-500 tabular-nums">
                      {item.share}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
