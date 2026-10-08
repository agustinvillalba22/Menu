import React, { useState } from 'react';
import { StockItem } from '../../types';
import {
  Package,
  AlertTriangle,
  Plus,
  Minus,
  RefreshCw,
  Search,
  CheckCircle2,
  Filter,
  Trash2,
  FileSpreadsheet,
  Check
} from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';
import { AddStockModal } from './AddStockModal';
import { StockImportModal } from './StockImportModal';

interface StockInventoryProps {
  stockItems: StockItem[];
  onRestock: (id: string, addedQty: number) => void;
  onAdjustStock?: (id: string, deltaQty: number) => void;
  onAddNewStockItem: (item: Omit<StockItem, 'id' | 'status' | 'lastRestocked'>) => void;
  onBatchAddStockItems?: (items: Omit<StockItem, 'id' | 'status' | 'lastRestocked'>[]) => void;
  onDeleteStockItem?: (id: string) => void;
}

export const StockInventory: React.FC<StockInventoryProps> = ({
  stockItems,
  onRestock,
  onAdjustStock,
  onAddNewStockItem,
  onBatchAddStockItems,
  onDeleteStockItem,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'critico' | 'bajo' | 'optimo'>('all');
  const [restockModalItem, setRestockModalItem] = useState<StockItem | null>(null);
  const [restockAmount, setRestockAmount] = useState<number>(5);
  const [itemToDelete, setItemToDelete] = useState<StockItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null);

  const filteredItems = stockItems.filter((item) => {
    const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const criticalCount = stockItems.filter((i) => i.status === 'critico').length;
  const lowCount = stockItems.filter((i) => i.status === 'bajo').length;

  const showFeedback = (msg: string) => {
    setFeedbackMsg(msg);
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  const handleManualAdd = (item: Omit<StockItem, 'id' | 'status' | 'lastRestocked'>) => {
    onAddNewStockItem(item);
    showFeedback(`Insumo "${item.name}" agregado exitosamente al inventario.`);
  };

  const handleBatchImport = (items: Omit<StockItem, 'id' | 'status' | 'lastRestocked'>[]) => {
    if (onBatchAddStockItems) {
      onBatchAddStockItems(items);
    } else {
      items.forEach((it) => onAddNewStockItem(it));
    }
    showFeedback(`Se importaron ${items.length} productos correctamente desde la planilla.`);
  };

  const handleRestockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!restockModalItem || restockAmount <= 0) return;
    onRestock(restockModalItem.id, Number(restockAmount));
    setRestockModalItem(null);
  };

  const getStatusBadge = (status: StockItem['status']) => {
    switch (status) {
      case 'critico':
        return (
          <span className="text-[11px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Crítico
          </span>
        );
      case 'bajo':
        return (
          <span className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Bajo stock
          </span>
        );
      case 'optimo':
      default:
        return (
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Óptimo
          </span>
        );
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Control de Stock & Mercadería
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Monitorea niveles de insumos, puntos de reposición y abastecimiento de cocina y barra.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {(criticalCount > 0 || lowCount > 0) && (
            <div className="text-xs px-3 py-1.5 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>
                {criticalCount + lowCount} insumos bajo umbral
              </span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-neutral-700 bg-white border border-neutral-300 hover:bg-neutral-50 rounded-lg transition-colors shadow-2xs"
            title="Importar productos desde planilla Excel o CSV"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <span>Importar Excel / CSV</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Agregar Mercadería</span>
          </button>
        </div>
      </div>

      {/* Floating Feedback Banner */}
      {feedbackMsg && (
        <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900 flex items-center justify-between gap-2 animate-in slide-in-from-top duration-200 shadow-2xs">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-emerald-700 hover:text-emerald-950 text-[11px] font-medium"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Main Table Card */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
        {/* Filters and search */}
        <div className="p-4 border-b border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === 'all'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Todos ({stockItems.length})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('critico')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === 'critico'
                  ? 'bg-red-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Críticos ({criticalCount})
            </button>
            <button
              type="button"
              onClick={() => setStatusFilter('bajo')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === 'bajo'
                  ? 'bg-amber-600 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Bajos ({lowCount})
            </button>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar insumo o materia prima..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-800"
            />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-neutral-50/70 border-b border-neutral-200 text-neutral-500 text-[11px]">
              <tr>
                <th className="py-2.5 px-4 font-medium">Insumo</th>
                <th className="py-2.5 px-4 font-medium">Categoría</th>
                <th className="py-2.5 px-4 font-medium text-right">Disponible</th>
                <th className="py-2.5 px-4 font-medium text-right">Mínimo</th>
                <th className="py-2.5 px-4 font-medium text-center">Estado</th>
                <th className="py-2.5 px-4 font-medium text-right">Última Reposición</th>
                <th className="py-2.5 px-4 font-medium text-right">Acción</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-neutral-50/60 transition-colors">
                  <td className="py-3 px-4 font-semibold text-neutral-900">
                    {item.name}
                  </td>
                  <td className="py-3 px-4 text-neutral-500">
                    {item.category}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-bold text-neutral-900 tabular-nums">
                    {item.quantity} {item.unit}
                  </td>
                  <td className="py-3 px-4 text-right font-mono text-neutral-400 tabular-nums">
                    {item.minThreshold} {item.unit}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex justify-center">
                      {getStatusBadge(item.status)}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-right text-neutral-400 font-mono text-[11px]">
                    {item.lastRestocked}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {onAdjustStock && (
                        <button
                          type="button"
                          onClick={() => onAdjustStock(item.id, -1)}
                          disabled={item.quantity <= 0}
                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-neutral-600 bg-neutral-100 hover:bg-neutral-200/80 disabled:opacity-40 rounded-md transition-colors"
                          title="Registrar consumo (-1 unidad)"
                        >
                          <Minus className="w-3 h-3 text-neutral-500" />
                          <span>-1</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setRestockModalItem(item);
                          setRestockAmount(5);
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200/80 rounded-md transition-colors"
                      >
                        <RefreshCw className="w-3 h-3 text-neutral-500" />
                        <span>Reponer</span>
                      </button>
                      {onDeleteStockItem && (
                        <button
                          type="button"
                          onClick={() => setItemToDelete(item)}
                          className="p-1 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                          title="Eliminar insumo"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Restock Modal */}
      {restockModalItem && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-sm overflow-hidden animate-in fade-in duration-150">
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">
                Registrar Ingreso de Mercadería
              </h3>
              <button
                type="button"
                onClick={() => setRestockModalItem(null)}
                className="text-xs text-neutral-400 hover:text-neutral-600"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="p-5 space-y-4">
              <div>
                <span className="text-[11px] text-neutral-500">Insumo:</span>
                <p className="text-xs font-semibold text-neutral-900">
                  {restockModalItem.name}
                </p>
                <p className="text-[11px] text-neutral-400 font-mono">
                  Stock actual: {restockModalItem.quantity} {restockModalItem.unit}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Cantidad a Ingresar ({restockModalItem.unit})
                </label>
                <input
                  type="number"
                  min="0.1"
                  step="any"
                  required
                  value={restockAmount}
                  onChange={(e) => setRestockAmount(Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-mono"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => setRestockModalItem(null)}
                  className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium text-white bg-neutral-900 rounded-md hover:bg-neutral-800"
                >
                  Confirmar Reposición
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal before deleting stock item */}
      <ConfirmModal
        isOpen={!!itemToDelete}
        title="¿Estás seguro que quieres eliminar?"
        itemName={itemToDelete ? `${itemToDelete.name} (${itemToDelete.quantity} ${itemToDelete.unit})` : undefined}
        description="Este insumo se eliminará del inventario y no figurará en las alertas de abastecimiento de cocina ni barra."
        confirmText="Sí, eliminar insumo"
        cancelText="Cancelar"
        onConfirm={() => {
          if (itemToDelete && onDeleteStockItem) {
            onDeleteStockItem(itemToDelete.id);
            setItemToDelete(null);
          }
        }}
        onCancel={() => setItemToDelete(null)}
      />

      {/* Manual Stock Item Creation Modal */}
      <AddStockModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onAdd={handleManualAdd}
      />

      {/* Bulk Excel/CSV Import Modal */}
      <StockImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleBatchImport}
        existingCount={stockItems.length}
      />
    </div>
  );
};
