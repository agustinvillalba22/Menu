import React, { useState } from 'react';
import { ShiftRecord, User } from '../../types';
import {
  Clock,
  DollarSign,
  Receipt,
  Users,
  CheckCircle2,
  AlertCircle,
  Plus,
  Play,
  StopCircle,
  Calendar,
  Lock,
  ArrowRight,
  TrendingUp
} from 'lucide-react';

interface ShiftsManagerProps {
  shifts: ShiftRecord[];
  activeStaff: User[];
  onOpenShift: (shiftName: ShiftRecord['shiftName'], initialCash: number, cashierName: string) => void;
  onCloseShift: (shiftId: string) => void;
}

export const ShiftsManager: React.FC<ShiftsManagerProps> = ({
  shifts,
  activeStaff,
  onOpenShift,
  onCloseShift,
}) => {
  const [isOpenModal, setIsOpenModal] = useState(false);
  const [newShiftName, setNewShiftName] = useState<ShiftRecord['shiftName']>('Turno Noche');
  const [initialCashInput, setInitialCashInput] = useState<number>(40000);
  const [cashierInput, setCashierInput] = useState<string>('Matías Rossi (Cajero)');

  const activeShift = shifts.find((s) => s.status === 'abierto');
  const closedShifts = shifts.filter((s) => s.status === 'cerrado');

  const handleCreateShift = (e: React.FormEvent) => {
    e.preventDefault();
    onOpenShift(newShiftName, Number(initialCashInput) || 0, cashierInput);
    setIsOpenModal(false);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Control Operativo de Turnos
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Gestión de apertura y cierre de servicio, arqueo de caja, comandas acumuladas y personal de salón.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {!activeShift ? (
            <button
              type="button"
              onClick={() => setIsOpenModal(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm"
            >
              <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
              <span>Abrir Nuevo Turno</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onCloseShift(activeShift.id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors shadow-2xs"
            >
              <StopCircle className="w-3.5 h-3.5 text-red-600" />
              <span>Cerrar Turno & Arqueo</span>
            </button>
          )}
        </div>
      </div>

      {/* Active Shift Card */}
      {activeShift ? (
        <div className="bg-white rounded-2xl border border-neutral-200 p-6 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-neutral-900">{activeShift.shiftName}</h3>
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                    En Servicio
                  </span>
                </div>
                <p className="text-[11px] text-neutral-500 mt-0.5">
                  Iniciado hoy a las {activeShift.openedAt} · Responsable: {activeShift.cashierName}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="text-[10px] text-neutral-400 block font-mono">Total Turno</span>
              <span className="text-lg font-bold text-neutral-900 font-mono">
                ${activeShift.totalSales.toLocaleString('es-AR')}
              </span>
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80">
              <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] mb-1">
                <DollarSign className="w-3.5 h-3.5" />
                <span>Caja Inicial</span>
              </div>
              <p className="text-sm font-bold text-neutral-900 font-mono">
                ${activeShift.initialCash.toLocaleString('es-AR')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80">
              <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] mb-1">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                <span>Ventas Registradas</span>
              </div>
              <p className="text-sm font-bold text-emerald-700 font-mono">
                ${activeShift.totalSales.toLocaleString('es-AR')}
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80">
              <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] mb-1">
                <Receipt className="w-3.5 h-3.5" />
                <span>Comandas Facturadas</span>
              </div>
              <p className="text-sm font-bold text-neutral-900 font-mono">
                {activeShift.totalOrders} mesas
              </p>
            </div>

            <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200/80">
              <div className="flex items-center gap-1.5 text-neutral-500 text-[11px] mb-1">
                <Users className="w-3.5 h-3.5" />
                <span>Equipo en Turno</span>
              </div>
              <p className="text-sm font-bold text-neutral-900 font-mono">
                {activeStaff.filter((u) => u.shiftActive).length} personas
              </p>
            </div>
          </div>

          {/* Active Staff Roster */}
          <div className="pt-2">
            <h4 className="text-xs font-semibold text-neutral-800 mb-2.5">
              Personal con Turno Activo en Salón & Cocina
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {activeStaff.map((staff) => (
                <div
                  key={staff.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between transition-colors ${
                    staff.shiftActive
                      ? 'bg-white border-neutral-200 shadow-2xs'
                      : 'bg-neutral-50/60 border-neutral-200/60 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src={staff.avatarUrl}
                      alt={staff.name}
                      className="w-7 h-7 rounded-full object-cover border border-neutral-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-semibold text-neutral-900 truncate">
                        {staff.name}
                      </p>
                      <p className="text-[10px] text-neutral-500 truncate">{staff.position}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                      staff.shiftActive
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {staff.shiftActive ? 'En servicio' : 'Inactivo'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-white rounded-2xl border border-neutral-200 shadow-xs">
          <Clock className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
          <h3 className="text-xs font-bold text-neutral-800">No hay ningún turno abierto actualmente</h3>
          <p className="text-[11px] text-neutral-500 mt-0.5 max-w-sm mx-auto">
            Abre el turno para habilitar la facturación de comandas, asignación de mesas a mozos y arqueo de caja.
          </p>
          <button
            type="button"
            onClick={() => setIsOpenModal(true)}
            className="mt-3.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm"
          >
            <Play className="w-3.5 h-3.5 text-emerald-400 fill-emerald-400" />
            <span>Iniciar Turno de Servicio</span>
          </button>
        </div>
      )}

      {/* Past Shifts History Table */}
      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-2xs">
        <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
          <h3 className="text-xs font-bold text-neutral-900">Historial de Turnos Cerrados</h3>
          <span className="text-[11px] text-neutral-400 font-mono">
            {closedShifts.length} turnos anteriores
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-neutral-500 text-[11px]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Turno</th>
                <th className="py-2.5 px-4 font-medium">Fecha</th>
                <th className="py-2.5 px-4 font-medium">Horario</th>
                <th className="py-2.5 px-4 font-medium">Responsable</th>
                <th className="py-2.5 px-4 font-medium text-right">Comandas</th>
                <th className="py-2.5 px-4 font-medium text-right">Venta Total</th>
                <th className="py-2.5 px-4 font-medium text-center">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {closedShifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-neutral-50/80 transition-colors">
                  <td className="py-3 px-4 font-semibold text-neutral-900">{shift.shiftName}</td>
                  <td className="py-3 px-4 text-neutral-600 font-mono text-[11px]">{shift.date}</td>
                  <td className="py-3 px-4 text-neutral-500 text-[11px]">
                    {shift.openedAt} - {shift.closedAt}
                  </td>
                  <td className="py-3 px-4 text-neutral-700">{shift.cashierName}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums text-neutral-700">
                    {shift.totalOrders}
                  </td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-neutral-900">
                    ${shift.totalSales.toLocaleString('es-AR')}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-600 bg-neutral-100 border border-neutral-200 px-2 py-0.5 rounded-full">
                      <Lock className="w-2.5 h-2.5 text-neutral-400" /> Cerrado
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Open Shift */}
      {isOpenModal && (
        <div className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-md overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 flex items-center justify-center">
                  <Play className="w-4 h-4 fill-emerald-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">Apertura de Turno</h3>
                  <p className="text-[11px] text-neutral-500">Inicia el registro de caja y comandas.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpenModal(false)}
                className="text-neutral-400 hover:text-neutral-700 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateShift} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Nombre del Turno *
                </label>
                <select
                  value={newShiftName}
                  onChange={(e) => setNewShiftName(e.target.value as ShiftRecord['shiftName'])}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white"
                >
                  <option value="Turno Mañana">Turno Mañana (08:00 - 15:00 hs)</option>
                  <option value="Turno Tarde">Turno Tarde (15:00 - 19:30 hs)</option>
                  <option value="Turno Noche">Turno Noche (19:30 - 02:00 hs)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Fondo Inicial de Caja ($) *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="500"
                  value={initialCashInput}
                  onChange={(e) => setInitialCashInput(Number(e.target.value))}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Cajero / Responsable *
                </label>
                <input
                  type="text"
                  required
                  value={cashierInput}
                  onChange={(e) => setCashierInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white"
                />
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsOpenModal(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm"
                >
                  Abrir Turno
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
