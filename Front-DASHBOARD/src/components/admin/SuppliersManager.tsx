import React, { useState } from 'react';
import { Supplier } from '../../types';
import {
  Truck,
  Plus,
  Search,
  Phone,
  Mail,
  Calendar,
  CreditCard,
  Building2,
  Trash2,
  Edit2,
  X,
  CheckCircle2,
  ExternalLink,
  MessageCircle,
  FileText
} from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';

interface SuppliersManagerProps {
  suppliers: Supplier[];
  onAddSupplier: (supplier: Omit<Supplier, 'id'>) => void;
  onUpdateSupplier: (supplier: Supplier) => void;
  onDeleteSupplier: (id: string) => void;
}

const CATEGORIES: Supplier['category'][] = [
  'Carnes & Pescados',
  'Verduras & Frescos',
  'Almacén & Secos',
  'Lácteos',
  'Bebidas & Licores',
  'Insumos Generales',
];

export const SuppliersManager: React.FC<SuppliersManagerProps> = ({
  suppliers,
  onAddSupplier,
  onUpdateSupplier,
  onDeleteSupplier,
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);

  // Form state
  const [formData, setFormData] = useState<Omit<Supplier, 'id'>>({
    name: '',
    category: 'Almacén & Secos',
    contactPerson: '',
    phone: '',
    email: '',
    address: '',
    deliveryDays: '',
    paymentTerms: 'Contra entrega',
    notes: '',
    status: 'activo',
  });

  const handleOpenAdd = () => {
    setEditingSupplier(null);
    setFormData({
      name: '',
      category: 'Almacén & Secos',
      contactPerson: '',
      phone: '',
      email: '',
      address: '',
      deliveryDays: 'Lunes a Viernes',
      paymentTerms: 'Contra entrega',
      notes: '',
      status: 'activo',
    });
    setIsModalOpen(true);
  };

  const handleOpenEdit = (sup: Supplier) => {
    setEditingSupplier(sup);
    setFormData({
      name: sup.name,
      category: sup.category,
      contactPerson: sup.contactPerson,
      phone: sup.phone,
      email: sup.email,
      address: sup.address || '',
      deliveryDays: sup.deliveryDays,
      paymentTerms: sup.paymentTerms,
      notes: sup.notes || '',
      status: sup.status,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) return;

    if (editingSupplier) {
      onUpdateSupplier({
        ...formData,
        id: editingSupplier.id,
      });
    } else {
      onAddSupplier(formData);
    }
    setIsModalOpen(false);
  };

  const filteredSuppliers = suppliers.filter((sup) => {
    const matchSearch =
      sup.name.toLowerCase().includes(search.toLowerCase()) ||
      sup.contactPerson.toLowerCase().includes(search.toLowerCase()) ||
      sup.deliveryDays.toLowerCase().includes(search.toLowerCase());
    const matchCategory = categoryFilter === 'all' || sup.category === categoryFilter;
    return matchSearch && matchCategory;
  });

  const activeCount = suppliers.filter((s) => s.status === 'activo').length;

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Gestión de Proveedores
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Directorio comercial de distribuidores, condiciones de pago y días de entrega para cocina y barra.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="text-xs px-3 py-1.5 rounded-lg bg-neutral-100 border border-neutral-200 text-neutral-700 font-medium">
            <span>{activeCount} proveedores activos</span>
          </div>

          <button
            type="button"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-sm"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Nuevo Proveedor</span>
          </button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white rounded-xl border border-neutral-200 p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-2xs">
        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
              categoryFilter === 'all'
                ? 'bg-neutral-900 text-white'
                : 'text-neutral-600 hover:bg-neutral-100'
            }`}
          >
            Todos ({suppliers.length})
          </button>
          {CATEGORIES.map((cat) => {
            const count = suppliers.filter((s) => s.category === cat).length;
            if (count === 0) return null;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors shrink-0 ${
                  categoryFilter === cat
                    ? 'bg-neutral-900 text-white'
                    : 'text-neutral-600 hover:bg-neutral-100'
                }`}
              >
                {cat} ({count})
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
          <input
            type="text"
            placeholder="Buscar proveedor o contacto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-800"
          />
        </div>
      </div>

      {/* Suppliers Grid / Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredSuppliers.map((supplier) => (
          <div
            key={supplier.id}
            className="bg-white rounded-xl border border-neutral-200 p-5 shadow-2xs hover:shadow-xs transition-shadow flex flex-col justify-between space-y-4"
          >
            <div>
              {/* Card Header */}
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 flex items-center justify-center shrink-0">
                    <Truck className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-neutral-900 leading-tight">
                      {supplier.name}
                    </h3>
                    <span className="inline-block mt-0.5 text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-medium">
                      {supplier.category}
                    </span>
                  </div>
                </div>

                <span
                  className={`text-[10px] px-2 py-0.5 rounded font-medium ${
                    supplier.status === 'activo'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : 'bg-neutral-100 text-neutral-500 border border-neutral-200'
                  }`}
                >
                  {supplier.status === 'activo' ? 'Activo' : 'Inactivo'}
                </span>
              </div>

              {/* Card Details */}
              <div className="mt-4 space-y-2 text-xs text-neutral-600">
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <span className="truncate">
                    Contacto: <strong className="text-neutral-800">{supplier.contactPerson}</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <a
                    href={`tel:${supplier.phone.replace(/\s+/g, '')}`}
                    className="hover:text-neutral-900 hover:underline font-mono text-[11px]"
                  >
                    {supplier.phone}
                  </a>
                </div>

                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                  <a
                    href={`mailto:${supplier.email}`}
                    className="hover:text-neutral-900 hover:underline text-[11px] truncate"
                  >
                    {supplier.email}
                  </a>
                </div>

                <div className="flex items-start gap-2 pt-1 border-t border-neutral-100">
                  <Calendar className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] text-neutral-500">
                    Entregas: <strong className="text-neutral-700 font-medium">{supplier.deliveryDays}</strong>
                  </span>
                </div>

                <div className="flex items-start gap-2">
                  <CreditCard className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] text-neutral-500">
                    Pago: <strong className="text-neutral-700 font-medium">{supplier.paymentTerms}</strong>
                  </span>
                </div>

                {supplier.notes && (
                  <div className="p-2 rounded-lg bg-neutral-50 border border-neutral-150 text-[11px] text-neutral-500 leading-snug">
                    {supplier.notes}
                  </div>
                )}
              </div>
            </div>

            {/* Card Actions Footer */}
            <div className="pt-3 border-t border-neutral-100 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <a
                  href={`https://wa.me/${supplier.phone.replace(/[^0-9]/g, '')}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors border border-emerald-200"
                  title="Contactar por WhatsApp"
                >
                  <MessageCircle className="w-3 h-3" />
                  <span>WhatsApp</span>
                </a>
              </div>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleOpenEdit(supplier)}
                  className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg transition-colors"
                  title="Editar proveedor"
                >
                  <Edit2 className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setSupplierToDelete(supplier)}
                  className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Eliminar proveedor"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredSuppliers.length === 0 && (
        <div className="p-12 text-center bg-white rounded-xl border border-neutral-200">
          <Truck className="w-8 h-8 text-neutral-300 mx-auto mb-2" />
          <p className="text-xs font-semibold text-neutral-700">No se encontraron proveedores</p>
          <p className="text-[11px] text-neutral-400 mt-0.5">
            Ajusta los filtros o agrega un nuevo proveedor a tu directorio.
          </p>
          <button
            type="button"
            onClick={handleOpenAdd}
            className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 rounded-lg"
          >
            <Plus className="w-3 h-3" />
            <span>Agregar Proveedor</span>
          </button>
        </div>
      )}

      {/* Modal Add / Edit Supplier */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-neutral-950/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-lg overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-700">
                  <Truck className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-neutral-900">
                    {editingSupplier ? 'Editar Proveedor' : 'Nuevo Proveedor'}
                  </h3>
                  <p className="text-[11px] text-neutral-500">
                    Información comercial y logística de pedidos.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-neutral-400 hover:text-neutral-700 rounded-lg hover:bg-neutral-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Nombre de la Empresa / Razón Social *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ej: Frigorífico Pampeano S.A."
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Categoría de Insumos *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value as Supplier['category'] })
                    }
                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white"
                  >
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Contacto / Ejecutivo Comercial *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej: Martín Gómez"
                    value={formData.contactPerson}
                    onChange={(e) => setFormData({ ...formData, contactPerson: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Teléfono / WhatsApp *
                  </label>
                  <input
                    type="tel"
                    required
                    placeholder="+54 11 4892-0000"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Correo Electrónico
                  </label>
                  <input
                    type="email"
                    placeholder="pedidos@proveedor.com"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Días y Horarios de Entrega
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Martes y Viernes mañana"
                    value={formData.deliveryDays}
                    onChange={(e) => setFormData({ ...formData, deliveryDays: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-neutral-700 mb-1">
                    Condición de Pago
                  </label>
                  <input
                    type="text"
                    placeholder="Ej: Contra entrega, Cta Cte 15 días"
                    value={formData.paymentTerms}
                    onChange={(e) => setFormData({ ...formData, paymentTerms: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-neutral-700 mb-1">
                  Notas de Abastecimiento o Pedido
                </label>
                <textarea
                  rows={2}
                  placeholder="Detalles sobre mínimos de compra, avisos previos o especificaciones..."
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="w-full px-3 py-2 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white resize-none"
                />
              </div>

              <div className="pt-3 border-t border-neutral-100 flex items-center justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-neutral-600 hover:bg-neutral-100 rounded-lg"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg shadow-sm"
                >
                  {editingSupplier ? 'Guardar Cambios' : 'Registrar Proveedor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal before deleting */}
      <ConfirmModal
        isOpen={!!supplierToDelete}
        title="¿Eliminar proveedor?"
        itemName={supplierToDelete?.name}
        description="Se eliminará la ficha de este proveedor del directorio comercial. Los insumos ya recibidos se mantendrán en stock."
        confirmText="Sí, eliminar"
        cancelText="Cancelar"
        onConfirm={() => {
          if (supplierToDelete) {
            onDeleteSupplier(supplierToDelete.id);
            setSupplierToDelete(null);
          }
        }}
        onCancel={() => setSupplierToDelete(null)}
      />
    </div>
  );
};
