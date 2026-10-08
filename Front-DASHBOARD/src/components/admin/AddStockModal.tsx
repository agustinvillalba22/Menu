import React, { useState } from 'react';
import { Package, X, CheckCircle2, AlertTriangle, Plus } from 'lucide-react';
import { StockItem } from '../../types';

interface AddStockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (item: Omit<StockItem, 'id' | 'status' | 'lastRestocked'>) => void;
}

const CATEGORIES: StockItem['category'][] = [
  'Carnes & Pescados',
  'Verduras & Frescos',
  'Almacén & Secos',
  'Lácteos',
  'Bebidas & Licores',
];

const UNITS: StockItem['unit'][] = ['kg', 'g', 'l', 'unidades', 'botellas'];

export const AddStockModal: React.FC<AddStockModalProps> = ({
  isOpen,
  onClose,
  onAdd,
}) => {
  const [name, setName] = useState('');
  const [category, setCategory] = useState<StockItem['category']>('Almacén & Secos');
  const [quantity, setQuantity] = useState<number>(10);
  const [unit, setUnit] = useState<StockItem['unit']>('kg');
  const [minThreshold, setMinThreshold] = useState<number>(5);
  const [costPerUnit, setCostPerUnit] = useState<number>(1500);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      category,
      quantity: Number(quantity) || 0,
      unit,
      minThreshold: Number(minThreshold) || 1,
      costPerUnit: Number(costPerUnit) || 0,
    });

    // Reset form
    setName('');
    setQuantity(10);
    setMinThreshold(5);
    setCostPerUnit(1500);
    onClose();
  };

  const isLow = quantity <= minThreshold;
  const isCrit = quantity < minThreshold * 0.7;

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-600">
              <Package className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-neutral-900">
                Agregar Mercadería al Stock
              </h2>
              <p className="text-[11px] text-neutral-500">
                Registra un nuevo insumo, materia prima o bebida en el inventario.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-neutral-700 mb-1">
              Nombre de la Mercadería / Insumo *
            </label>
            <input
              type="text"
              required
              placeholder="Ej: Mozzarella Fior di Latte, Lomo vacuno, Gin London Dry..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-900 focus:outline-none transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Categoría *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as StockItem['category'])}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-900 focus:outline-none transition-colors"
              >
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Unidad de Medida *
              </label>
              <select
                value={unit}
                onChange={(e) => setUnit(e.target.value as StockItem['unit'])}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-900 focus:outline-none transition-colors"
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Stock Inicial ({unit}) *
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={quantity}
                onChange={(e) => setQuantity(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-900 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Umbral Mínimo ({unit}) *
              </label>
              <input
                type="number"
                step="any"
                min="0.1"
                required
                value={minThreshold}
                onChange={(e) => setMinThreshold(parseFloat(e.target.value) || 1)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-900 focus:outline-none font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-neutral-700 mb-1">
                Costo Unitario ($)
              </label>
              <input
                type="number"
                step="any"
                min="0"
                value={costPerUnit}
                onChange={(e) => setCostPerUnit(parseFloat(e.target.value) || 0)}
                className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:border-neutral-900 focus:outline-none font-mono"
              />
            </div>
          </div>

          {/* Status Preview */}
          <div className="p-3 bg-neutral-50 rounded-xl border border-neutral-200/80 flex items-center justify-between text-xs">
            <span className="text-neutral-600 font-medium">Estado inicial de stock:</span>
            {isCrit ? (
              <span className="font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded flex items-center gap-1 text-[11px]">
                <AlertTriangle className="w-3 h-3" /> Crítico (requiere reposición)
              </span>
            ) : isLow ? (
              <span className="font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1 text-[11px]">
                <AlertTriangle className="w-3 h-3" /> Bajo stock
              </span>
            ) : (
              <span className="font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 text-[11px]">
                <CheckCircle2 className="w-3 h-3" /> Óptimo
              </span>
            )}
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm"
            >
              <Plus className="w-4 h-4" />
              <span>Guardar en Stock</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
