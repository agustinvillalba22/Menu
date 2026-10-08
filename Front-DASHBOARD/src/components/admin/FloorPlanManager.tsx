import React, { useState } from 'react';
import { Table, TableStatus, TableShape, Reservation } from '../../types';
import {
  LayoutGrid,
  Plus,
  Users,
  Calendar,
  Clock,
  Phone,
  Check,
  Armchair,
  Info,
  Edit2,
  Trash2
} from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';

interface FloorPlanManagerProps {
  tables: Table[];
  onUpdateTable: (table: Table) => void;
  onAddTable: (table: Omit<Table, 'id'>) => void;
  onRemoveTable: (id: string) => void;
  onSaveReservation: (reservation: Reservation) => void;
}

export const FloorPlanManager: React.FC<FloorPlanManagerProps> = ({
  tables,
  onUpdateTable,
  onAddTable,
  onRemoveTable,
  onSaveReservation,
}) => {
  const [selectedTable, setSelectedTable] = useState<Table | null>(tables[0] || null);
  const [isAddingTable, setIsAddingTable] = useState(false);
  const [isBookingModalOpen, setIsBookingModalOpen] = useState(false);
  const [confirmDeleteTable, setConfirmDeleteTable] = useState<Table | null>(null);
  const [confirmCancelReservation, setConfirmCancelReservation] = useState<Reservation | null>(null);

  // Form for new table
  const [newTableNumber, setNewTableNumber] = useState(tables.length + 1);
  const [newTableCapacity, setNewTableCapacity] = useState(4);
  const [newTableShape, setNewTableShape] = useState<TableShape>('square');

  // Form for reservation
  const [resName, setResName] = useState('');
  const [resPhone, setResPhone] = useState('');
  const [resTime, setResTime] = useState('21:00 hs');
  const [resGuests, setResGuests] = useState(selectedTable?.capacity || 2);
  const [resNotes, setResNotes] = useState('');

  const totalSeats = tables.reduce((acc, t) => acc + t.capacity, 0);
  const occupiedTables = tables.filter((t) => t.status === 'ocupada').length;
  const reservedTables = tables.filter((t) => t.status === 'reservada').length;

  const handleCreateTable = (e: React.FormEvent) => {
    e.preventDefault();
    onAddTable({
      number: newTableNumber,
      capacity: newTableCapacity,
      shape: newTableShape,
      x: 50,
      y: 50,
      status: 'libre',
    });
    setIsAddingTable(false);
    setNewTableNumber(tables.length + 2);
  };

  const handleBookingSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !resName.trim()) return;

    const newReservation: Reservation = {
      id: `res-${Date.now()}`,
      tableNumber: selectedTable.number,
      customerName: resName.trim(),
      customerPhone: resPhone.trim(),
      time: resTime,
      guests: Number(resGuests) || selectedTable.capacity,
      notes: resNotes.trim() || undefined,
    };

    onSaveReservation(newReservation);
    setIsBookingModalOpen(false);
    setResName('');
    setResPhone('');
    setResNotes('');
  };

  const getStatusColor = (status: TableStatus) => {
    switch (status) {
      case 'ocupada':
        return 'bg-amber-100 text-amber-900 border-amber-300';
      case 'cuenta':
        return 'bg-blue-100 text-blue-900 border-blue-300';
      case 'reservada':
        return 'bg-purple-100 text-purple-900 border-purple-300';
      case 'libre':
      default:
        return 'bg-emerald-50 text-emerald-800 border-emerald-300';
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Distribución del Salón & Reservas
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Configura la cantidad de mesas, capacidad de comensales y gestiona reservas por plano interactivo.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddingTable(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar Mesa</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-neutral-200">
          <span className="text-[11px] text-neutral-500">Total de Mesas</span>
          <p className="text-xl font-bold font-mono text-neutral-900 mt-0.5 tabular-nums">
            {tables.length}
          </p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-neutral-200">
          <span className="text-[11px] text-neutral-500">Capacidad Total</span>
          <p className="text-xl font-bold font-mono text-neutral-900 mt-0.5 tabular-nums">
            {totalSeats} cubiertos
          </p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-neutral-200">
          <span className="text-[11px] text-neutral-500">Mesas Ocupadas</span>
          <p className="text-xl font-bold font-mono text-amber-700 mt-0.5 tabular-nums">
            {occupiedTables}
          </p>
        </div>
        <div className="bg-white p-3.5 rounded-xl border border-neutral-200">
          <span className="text-[11px] text-neutral-500">Mesas Reservadas</span>
          <p className="text-xl font-bold font-mono text-purple-700 mt-0.5 tabular-nums">
            {reservedTables}
          </p>
        </div>
      </div>

      {/* Main Floor Plan Grid & Table Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Interactive Salon Plan (8 cols) */}
        <div className="lg:col-span-8 bg-white p-5 rounded-xl border border-neutral-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <div className="flex items-center gap-2">
              <LayoutGrid className="w-4 h-4 text-neutral-500" />
              <span className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                Plano 2D del Salón Principal
              </span>
            </div>

            {/* Status Legend */}
            <div className="flex items-center gap-3 text-[10px] text-neutral-500">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500" /> Libre
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-500" /> Ocupada
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-blue-500" /> Cuenta
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-500" /> Reservada
              </span>
            </div>
          </div>

          {/* 2D Architectural Layout Canvas */}
          <div className="relative w-full h-[400px] bg-neutral-50 border border-neutral-200 rounded-xl overflow-hidden p-6 pattern-grid">
            {/* Restaurant Entrance Marker */}
            <div className="absolute top-2 left-1/2 -translate-x-1/2 px-3 py-0.5 bg-neutral-200 rounded text-[10px] text-neutral-600 font-medium uppercase tracking-wider">
              Acceso Principal / Recepción
            </div>

            {/* Bar & Kitchen Marker */}
            <div className="absolute bottom-2 left-6 px-3 py-0.5 bg-neutral-200 rounded text-[10px] text-neutral-600 font-medium uppercase tracking-wider">
              Barra & Coctelería
            </div>

            {/* Tables positioned on salon */}
            {tables.map((tbl) => {
              const isSelected = selectedTable?.id === tbl.id;
              const shapeClass =
                tbl.shape === 'round'
                  ? 'rounded-full aspect-square'
                  : tbl.shape === 'rectangle'
                  ? 'rounded-lg w-24 h-16'
                  : 'rounded-lg aspect-square w-18 h-18';

              return (
                <button
                  key={tbl.id}
                  type="button"
                  onClick={() => setSelectedTable(tbl)}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center p-2 border-2 transition-all shadow-xs cursor-pointer ${shapeClass} ${getStatusColor(
                    tbl.status
                  )} ${
                    isSelected
                      ? 'ring-2 ring-neutral-900 ring-offset-2 scale-105 z-10'
                      : 'hover:scale-102'
                  }`}
                  style={{ left: `${tbl.x}%`, top: `${tbl.y}%` }}
                >
                  <span className="font-bold text-xs font-mono">
                    Mesa {tbl.number}
                  </span>
                  <span className="text-[10px] opacity-80 flex items-center gap-0.5">
                    <Users className="w-2.5 h-2.5" /> {tbl.capacity}
                  </span>
                  {tbl.status === 'reservada' && (
                    <span className="text-[9px] font-semibold text-purple-700">
                      Res.
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-neutral-400">
            Haz clic en cualquier mesa para editar su capacidad, forma o agendar una reserva directa.
          </p>
        </div>

        {/* Selected Table Inspector & Reservation Box (4 cols) */}
        <div className="lg:col-span-4 space-y-4">
          {selectedTable ? (
            <div className="bg-white p-5 rounded-xl border border-neutral-200 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <Armchair className="w-4 h-4 text-neutral-500" />
                  <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                    Detalle Mesa #{selectedTable.number}
                  </h3>
                </div>
                <span
                  className={`text-[10px] font-medium px-2 py-0.5 rounded capitalize ${getStatusColor(
                    selectedTable.status
                  )}`}
                >
                  {selectedTable.status}
                </span>
              </div>

              {/* Edit capacity and shape */}
              <div className="space-y-3">
                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                    Capacidad (comensales)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="20"
                    value={selectedTable.capacity}
                    onChange={(e) =>
                      onUpdateTable({
                        ...selectedTable,
                        capacity: Number(e.target.value) || 2,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                    Geometría / Forma
                  </label>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(['square', 'round', 'rectangle'] as TableShape[]).map((shape) => (
                      <button
                        key={shape}
                        type="button"
                        onClick={() =>
                          onUpdateTable({
                            ...selectedTable,
                            shape,
                          })
                        }
                        className={`py-1 text-xs rounded capitalize transition-colors ${
                          selectedTable.shape === shape
                            ? 'bg-neutral-900 text-white font-medium'
                            : 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200'
                        }`}
                      >
                        {shape === 'square'
                          ? 'Cuadrada'
                          : shape === 'round'
                          ? 'Redonda'
                          : 'Rectangular'}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                    Estado Actual
                  </label>
                  <select
                    value={selectedTable.status}
                    onChange={(e) =>
                      onUpdateTable({
                        ...selectedTable,
                        status: e.target.value as TableStatus,
                      })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800"
                  >
                    <option value="libre">Libre / Disponible</option>
                    <option value="ocupada">Ocupada</option>
                    <option value="cuenta">Pidiendo cuenta</option>
                    <option value="reservada">Reservada</option>
                  </select>
                </div>
              </div>

              {/* Reservation card if reserved */}
              {selectedTable.currentReservation ? (
                <div className="p-3 bg-purple-50/70 border border-purple-200 rounded-lg space-y-1.5 text-xs text-purple-950">
                  <div className="flex items-center justify-between font-semibold">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-purple-600" />
                      <span>Reserva Activa</span>
                    </span>
                    <span className="text-[11px] font-mono text-purple-700">
                      {selectedTable.currentReservation.time}
                    </span>
                  </div>
                  <p className="font-medium">
                    {selectedTable.currentReservation.customerName} (
                    {selectedTable.currentReservation.guests} personas)
                  </p>
                  <p className="text-[11px] text-purple-700 font-mono">
                    Tel: {selectedTable.currentReservation.customerPhone}
                  </p>
                  {selectedTable.currentReservation.notes && (
                    <p className="text-[11px] text-purple-800 italic pt-1 border-t border-purple-200/60">
                      "{selectedTable.currentReservation.notes}"
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() =>
                      setConfirmCancelReservation(selectedTable.currentReservation || null)
                    }
                    className="text-[11px] text-red-600 hover:underline pt-1 block"
                  >
                    Cancelar reserva y liberar mesa
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-purple-800 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-lg transition-colors"
                >
                  <Calendar className="w-3.5 h-3.5 text-purple-600" />
                  <span>Agendar Reserva en Mesa #{selectedTable.number}</span>
                </button>
              )}

              <div className="pt-2 border-t border-neutral-100 flex justify-end">
                <button
                  type="button"
                  onClick={() => setConfirmDeleteTable(selectedTable)}
                  className="text-[11px] text-red-500 hover:text-red-700 inline-flex items-center gap-1"
                >
                  <Trash2 className="w-3 h-3" />
                  <span>Eliminar esta mesa</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white p-5 rounded-xl border border-neutral-200 text-center text-xs text-neutral-400">
              Selecciona una mesa en el plano para ver sus detalles.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Agendar Reserva */}
      {isBookingModalOpen && selectedTable && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-md overflow-hidden animate-in fade-in duration-150">
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">
                Reservar Mesa #{selectedTable.number} ({selectedTable.capacity} lugares)
              </h3>
              <button
                type="button"
                onClick={() => setIsBookingModalOpen(false)}
                className="text-xs text-neutral-400 hover:text-neutral-600"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleBookingSubmit} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Nombre del Comensal / Titular
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Laura Benítez"
                  value={resName}
                  onChange={(e) => setResName(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Teléfono
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="+54 9 11..."
                    value={resPhone}
                    onChange={(e) => setResPhone(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Hora
                  </label>
                  <input
                    type="text"
                    required
                    value={resTime}
                    onChange={(e) => setResTime(e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Cantidad de Comensales
                </label>
                <input
                  type="number"
                  min="1"
                  max={selectedTable.capacity}
                  value={resGuests}
                  onChange={(e) => setResGuests(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Notas Especiales / Preferencias
                </label>
                <textarea
                  rows={2}
                  placeholder="Cumpleaños, intolerancias, vino preferido..."
                  value={resNotes}
                  onChange={(e) => setResNotes(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsBookingModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium text-white bg-neutral-900 rounded-md hover:bg-neutral-800"
                >
                  Confirmar Reserva
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Crear Mesa */}
      {isAddingTable && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-sm overflow-hidden animate-in fade-in duration-150">
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">
                Nueva Mesa de Salón
              </h3>
              <button
                type="button"
                onClick={() => setIsAddingTable(false)}
                className="text-xs text-neutral-400 hover:text-neutral-600"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleCreateTable} className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Número de Mesa
                </label>
                <input
                  type="number"
                  required
                  value={newTableNumber}
                  onChange={(e) => setNewTableNumber(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Capacidad de Lugares
                </label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  required
                  value={newTableCapacity}
                  onChange={(e) => setNewTableCapacity(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Forma
                </label>
                <select
                  value={newTableShape}
                  onChange={(e) => setNewTableShape(e.target.value as TableShape)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800"
                >
                  <option value="square">Cuadrada (2 a 4 pax)</option>
                  <option value="rectangle">Rectangular (4 a 8 pax)</option>
                  <option value="round">Redonda (2 a 6 pax)</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setIsAddingTable(false)}
                  className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium text-white bg-neutral-900 rounded-md hover:bg-neutral-800"
                >
                  Agregar Mesa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal before deleting table */}
      <ConfirmModal
        isOpen={!!confirmDeleteTable}
        title="¿Estás seguro que quieres eliminar?"
        itemName={confirmDeleteTable ? `Mesa #${confirmDeleteTable.number} (${confirmDeleteTable.capacity} cubiertos)` : undefined}
        description="Esta mesa se eliminará del plano de salón y no se podrá utilizar para asignar comensales ni recibir reservas."
        confirmText="Sí, eliminar mesa"
        cancelText="Cancelar"
        onConfirm={() => {
          if (confirmDeleteTable) {
            onRemoveTable(confirmDeleteTable.id);
            if (selectedTable?.id === confirmDeleteTable.id) {
              setSelectedTable(null);
            }
            setConfirmDeleteTable(null);
          }
        }}
        onCancel={() => setConfirmDeleteTable(null)}
      />

      {/* Confirmation Modal before canceling reservation */}
      <ConfirmModal
        isOpen={!!confirmCancelReservation}
        title="¿Estás seguro que quieres eliminar?"
        itemName={confirmCancelReservation ? `Reserva: ${confirmCancelReservation.customerName} (${confirmCancelReservation.time})` : undefined}
        description="La reserva será cancelada y la mesa pasará a estar disponible inmediatamente en el salón."
        confirmText="Sí, cancelar reserva"
        cancelText="Volver"
        onConfirm={() => {
          if (confirmCancelReservation && selectedTable) {
            onUpdateTable({
              ...selectedTable,
              status: 'libre',
              currentReservation: undefined,
            });
            setConfirmCancelReservation(null);
          }
        }}
        onCancel={() => setConfirmCancelReservation(null)}
      />
    </div>
  );
};
