import React, { useState } from 'react';
import {
  Table,
  Order,
  Product,
  Category,
  OrderItem,
  TableStatus
} from '../../types';
import {
  Armchair,
  Users,
  Plus,
  Receipt,
  CheckCircle,
  Clock,
  Sparkles,
  ShoppingBag,
  CreditCard,
  X,
  Search,
  Check,
  Trash2
} from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';

interface TablesViewProps {
  tables: Table[];
  orders: Order[];
  products: Product[];
  categories: Category[];
  currentUserName: string;
  onUpdateTable: (table: Table) => void;
  onCreateOrderFromTable: (order: Omit<Order, 'id' | 'createdAt' | 'elapsedMinutes'>) => void;
  onCloseTableBill: (tableId: string) => void;
}

export const TablesView: React.FC<TablesViewProps> = ({
  tables,
  orders,
  products,
  categories,
  currentUserName,
  onUpdateTable,
  onCreateOrderFromTable,
  onCloseTableBill,
}) => {
  const [selectedTable, setSelectedTable] = useState<Table | null>(tables[0] || null);
  const [isNewOrderModalOpen, setIsNewOrderModalOpen] = useState(false);

  // New Order Cart within modal
  const [orderCart, setOrderCart] = useState<OrderItem[]>([]);
  const [selectedModalCatId, setSelectedModalCatId] = useState<string>('all');
  const [modalSearch, setModalSearch] = useState('');
  const [customItemNote, setCustomItemNote] = useState<{ [productId: string]: string }>({});
  const [tableToClose, setTableToClose] = useState<Table | null>(null);
  const [itemToRemoveFromCart, setItemToRemoveFromCart] = useState<OrderItem | null>(null);

  const activeTableOrder = selectedTable?.activeOrderId
    ? orders.find((o) => o.id === selectedTable.activeOrderId)
    : null;

  const handleAddItemToOrder = (prod: Product) => {
    const existing = orderCart.find((i) => i.productId === prod.id);
    if (existing) {
      setOrderCart(
        orderCart.map((i) =>
          i.productId === prod.id ? { ...i, quantity: i.quantity + 1 } : i
        )
      );
    } else {
      setOrderCart([
        ...orderCart,
        {
          productId: prod.id,
          name: prod.name,
          quantity: 1,
          unitPrice: prod.price,
          notes: customItemNote[prod.id] || '',
        },
      ]);
    }
  };

  const handleRemoveItemFromOrder = (prodId: string) => {
    const existing = orderCart.find((i) => i.productId === prodId);
    if (existing && existing.quantity > 1) {
      setOrderCart(
        orderCart.map((i) =>
          i.productId === prodId ? { ...i, quantity: i.quantity - 1 } : i
        )
      );
    } else {
      setOrderCart(orderCart.filter((i) => i.productId !== prodId));
    }
  };

  const handleConfirmTableOrder = () => {
    if (!selectedTable || orderCart.length === 0) return;

    const cartTotal = orderCart.reduce(
      (acc, item) => acc + item.quantity * item.unitPrice,
      0
    );

    // Create the order that will reflect in Comandas immediately!
    onCreateOrderFromTable({
      code: `#M${selectedTable.number}-${Math.floor(100 + Math.random() * 900)}`,
      channel: 'mesa',
      tableNumber: selectedTable.number,
      waiterName: currentUserName,
      status: 'pendiente',
      priority: 'alta',
      total: cartTotal,
      items: orderCart,
    });

    // Update table state
    onUpdateTable({
      ...selectedTable,
      status: 'ocupada',
      activeOrderTotal: (selectedTable.activeOrderTotal || 0) + cartTotal,
      waiterName: currentUserName,
      seatedMinutes: selectedTable.seatedMinutes || 1,
    });

    setOrderCart([]);
    setIsNewOrderModalOpen(false);
  };

  const handleSeatTable = (table: Table) => {
    onUpdateTable({
      ...table,
      status: 'ocupada',
      seatedMinutes: 1,
      waiterName: currentUserName,
    });
    setSelectedTable({
      ...table,
      status: 'ocupada',
      seatedMinutes: 1,
      waiterName: currentUserName,
    });
  };

  const getStatusBadge = (status: TableStatus) => {
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

  const filteredModalProducts = products.filter((p) => {
    const matchCat =
      selectedModalCatId === 'all' || p.categoryId === selectedModalCatId;
    const matchSearch =
      modalSearch.trim() === '' ||
      p.name.toLowerCase().includes(modalSearch.toLowerCase());
    return matchCat && matchSearch && p.available;
  });

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Plano Operativo de Mesas
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Control de mesas en tiempo real, comanda directa hacia cocina y gestión de cuentas.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-neutral-500 font-mono">
            {tables.filter((t) => t.status === 'ocupada').length} mesas atendidas
          </span>
        </div>
      </div>

      {/* Main Grid: Tables Canvas Left (7 cols), Selected Table Drawer Right (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Salon Tables Grid (7 cols) */}
        <div className="lg:col-span-7 bg-white p-5 rounded-xl border border-neutral-200 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
            <span className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
              Mesas del Salón Principal
            </span>
            <div className="flex items-center gap-2 text-[10px] text-neutral-500">
              <span className="w-2 h-2 rounded-full bg-emerald-500" /> Libre
              <span className="w-2 h-2 rounded-full bg-amber-500 ml-2" /> Ocupada
              <span className="w-2 h-2 rounded-full bg-blue-500 ml-2" /> Cuenta
              <span className="w-2 h-2 rounded-full bg-purple-500 ml-2" /> Reservada
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {tables.map((t) => {
              const isSelected = selectedTable?.id === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedTable(t)}
                  className={`p-3.5 rounded-xl border text-left transition-all relative flex flex-col justify-between h-32 ${
                    isSelected
                      ? 'border-neutral-900 ring-2 ring-neutral-900/10 shadow-sm bg-neutral-50'
                      : 'border-neutral-200 bg-white hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-sm font-bold font-mono text-neutral-900">
                        Mesa {t.number}
                      </span>
                      <span className="text-[11px] text-neutral-500 flex items-center gap-1 mt-0.5">
                        <Users className="w-3 h-3 text-neutral-400" /> {t.capacity} pax
                      </span>
                    </div>

                    <span
                      className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded border capitalize ${getStatusBadge(
                        t.status
                      )}`}
                    >
                      {t.status}
                    </span>
                  </div>

                  <div className="mt-2 pt-2 border-t border-neutral-100 flex items-end justify-between">
                    <div>
                      {t.status === 'ocupada' && t.activeOrderTotal ? (
                        <div>
                          <span className="text-[10px] text-neutral-400 font-mono block">
                            Consumo:
                          </span>
                          <span className="text-xs font-bold font-mono text-neutral-900 tabular-nums">
                            ${t.activeOrderTotal.toLocaleString('es-AR')}
                          </span>
                        </div>
                      ) : t.status === 'reservada' && t.currentReservation ? (
                        <span className="text-[10px] text-purple-700 font-medium truncate block max-w-[90px]">
                          {t.currentReservation.customerName}
                        </span>
                      ) : (
                        <span className="text-[10px] text-neutral-400">
                          Disponible
                        </span>
                      )}
                    </div>

                    {t.seatedMinutes && t.status === 'ocupada' && (
                      <span className="text-[10px] text-neutral-400 font-mono flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" /> {t.seatedMinutes}m
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Table Drawer / Action Panel (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          {selectedTable ? (
            <div className="bg-white p-5 rounded-xl border border-neutral-200 space-y-5">
              <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
                <div>
                  <h3 className="text-sm font-bold text-neutral-900 font-mono">
                    Mesa #{selectedTable.number}
                  </h3>
                  <p className="text-xs text-neutral-500">
                    Capacidad: {selectedTable.capacity} comensales · Mozo: {selectedTable.waiterName || currentUserName}
                  </p>
                </div>
                <span
                  className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded border capitalize ${getStatusBadge(
                    selectedTable.status
                  )}`}
                >
                  {selectedTable.status}
                </span>
              </div>

              {/* Status Actions */}
              {selectedTable.status === 'libre' ? (
                <div className="space-y-3">
                  <div className="p-4 bg-neutral-50 rounded-lg text-center space-y-2 border border-neutral-100">
                    <Armchair className="w-8 h-8 text-neutral-400 mx-auto" />
                    <p className="text-xs text-neutral-600">
                      Mesa libre. Ocupa la mesa para asignar comensales o cargar una nueva comanda.
                    </p>
                    <button
                      type="button"
                      onClick={() => handleSeatTable(selectedTable)}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors shadow-xs"
                    >
                      <Users className="w-3.5 h-3.5" />
                      <span>Sentar Comensales</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Current Table Orders List */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                        Pedidos Cargados en la Mesa
                      </span>
                      {selectedTable.activeOrderTotal && (
                        <span className="text-xs font-mono font-bold text-neutral-900 tabular-nums">
                          Total: ${selectedTable.activeOrderTotal.toLocaleString('es-AR')}
                        </span>
                      )}
                    </div>

                    {activeTableOrder && activeTableOrder.items.length > 0 ? (
                      <div className="space-y-2 border border-neutral-100 rounded-lg p-3 bg-neutral-50/50">
                        {activeTableOrder.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs py-1 border-b border-neutral-200/50 last:border-0"
                          >
                            <div>
                              <span className="font-medium text-neutral-800">
                                {item.quantity}x {item.name}
                              </span>
                              {item.notes && (
                                <p className="text-[10px] text-amber-700 italic">
                                  Nota: {item.notes}
                                </p>
                              )}
                            </div>
                            <span className="font-mono text-neutral-700 tabular-nums">
                              ${(item.quantity * item.unitPrice).toLocaleString('es-AR')}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="p-3 bg-neutral-50 rounded-lg text-xs text-neutral-500 text-center">
                        Mesa abierta sin pedidos enviados todavía.
                      </div>
                    )}
                  </div>

                  {/* Operational Action Buttons */}
                  <div className="space-y-2 pt-2 border-t border-neutral-100">
                    <button
                      type="button"
                      onClick={() => setIsNewOrderModalOpen(true)}
                      className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors shadow-xs"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Cargar Nuevo Pedido (Comanda)</span>
                    </button>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          onUpdateTable({
                            ...selectedTable,
                            status: 'cuenta',
                          })
                        }
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                      >
                        <Receipt className="w-3.5 h-3.5" />
                        <span>Pedir Cuenta</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setTableToClose(selectedTable)}
                        className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Cobrar y Liberar</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white p-5 rounded-xl border border-neutral-200 text-center text-xs text-neutral-400">
              Selecciona una mesa para ver su estado operativo.
            </div>
          )}
        </div>
      </div>

      {/* Modal: Cargar Nuevo Pedido para la Mesa */}
      {isNewOrderModalOpen && selectedTable && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-3 md:p-6">
          <div className="bg-white rounded-2xl shadow-2xl border border-neutral-200 w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b border-neutral-100 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-neutral-900">
                  Cargar Pedido en Mesa #{selectedTable.number}
                </h3>
                <p className="text-xs text-neutral-500">
                  Selecciona los platos o bebidas del menú. Al confirmar se enviará la comanda a cocina y barra.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsNewOrderModalOpen(false)}
                className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body: Left Dishes Catalog (7 cols), Right Current Order Ticket (5 cols) */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-12 overflow-hidden">
              {/* Dishes Catalog (7 cols) */}
              <div className="md:col-span-7 p-4 border-r border-neutral-100 flex flex-col h-full overflow-hidden">
                {/* Search & Category Filter */}
                <div className="space-y-2.5 pb-3">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Buscar plato, pasta, trago..."
                      value={modalSearch}
                      onChange={(e) => setModalSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                    <button
                      type="button"
                      onClick={() => setSelectedModalCatId('all')}
                      className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                        selectedModalCatId === 'all'
                          ? 'bg-neutral-900 text-white font-medium'
                          : 'text-neutral-600 hover:bg-neutral-100'
                      }`}
                    >
                      Todos
                    </button>
                    {categories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedModalCatId(c.id)}
                        className={`px-2.5 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                          selectedModalCatId === c.id
                            ? 'bg-neutral-900 text-white font-medium'
                            : 'text-neutral-600 hover:bg-neutral-100'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Items List */}
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {filteredModalProducts.map((p) => {
                    const cartItem = orderCart.find((i) => i.productId === p.id);
                    return (
                      <div
                        key={p.id}
                        className="p-2.5 rounded-lg border border-neutral-200/80 hover:border-neutral-300 flex items-center justify-between gap-3 transition-colors"
                      >
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-neutral-900 truncate">
                            {p.name}
                          </h4>
                          <span className="font-mono text-xs font-semibold text-neutral-700 tabular-nums">
                            ${p.price.toLocaleString('es-AR')}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {cartItem ? (
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => handleRemoveItemFromOrder(p.id)}
                                className="w-6 h-6 rounded bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold flex items-center justify-center text-xs"
                              >
                                -
                              </button>
                              <span className="font-mono font-bold text-xs tabular-nums">
                                {cartItem.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleAddItemToOrder(p)}
                                className="w-6 h-6 rounded bg-neutral-900 text-white hover:bg-neutral-800 font-bold flex items-center justify-center text-xs"
                              >
                                +
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleAddItemToOrder(p)}
                              className="px-2.5 py-1 text-xs font-medium text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-md transition-colors"
                            >
                              + Agregar
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Order Cart Ticket (5 cols) */}
              <div className="md:col-span-5 p-4 flex flex-col justify-between bg-neutral-50/60 h-full">
                <div className="space-y-3 overflow-y-auto">
                  <div className="flex items-center justify-between pb-2 border-b border-neutral-200">
                    <span className="text-xs font-semibold text-neutral-900 uppercase tracking-wider">
                      Comanda a Enviar
                    </span>
                    <span className="text-xs text-neutral-500 font-mono">
                      {orderCart.length} ítems
                    </span>
                  </div>

                  {orderCart.length > 0 ? (
                    <div className="space-y-2">
                      {orderCart.map((item) => (
                        <div
                          key={item.productId}
                          className="p-2 bg-white rounded-lg border border-neutral-200/80 space-y-1"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-medium text-neutral-800">
                              {item.quantity}x {item.name}
                            </span>
                            <div className="flex items-center gap-2">
                              <span className="font-mono font-semibold text-neutral-900 tabular-nums">
                                ${(item.quantity * item.unitPrice).toLocaleString('es-AR')}
                              </span>
                              <button
                                type="button"
                                onClick={() => setItemToRemoveFromCart(item)}
                                className="p-1 text-neutral-400 hover:text-red-600 rounded hover:bg-red-50 transition-colors"
                                title="Quitar de la comanda"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          <input
                            type="text"
                            placeholder="Nota para cocina (ej: bien cocido, sin sal)..."
                            value={item.notes || ''}
                            onChange={(e) =>
                              setOrderCart(
                                orderCart.map((i) =>
                                  i.productId === item.productId
                                    ? { ...i, notes: e.target.value }
                                    : i
                                )
                              )
                            }
                            className="w-full px-2 py-0.5 text-[11px] rounded border border-neutral-200 bg-neutral-50 text-neutral-700"
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-8 text-center text-xs text-neutral-400">
                      Selecciona platos a la izquierda para agregarlos a la comanda.
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-neutral-200 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-neutral-700">
                      Total Comanda:
                    </span>
                    <span className="text-base font-bold font-mono text-neutral-900 tabular-nums">
                      $
                      {orderCart
                        .reduce((a, b) => a + b.quantity * b.unitPrice, 0)
                        .toLocaleString('es-AR')}
                    </span>
                  </div>

                  <button
                    type="button"
                    disabled={orderCart.length === 0}
                    onClick={handleConfirmTableOrder}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs font-semibold text-white bg-neutral-900 rounded-lg hover:bg-neutral-800 transition-colors shadow-xs disabled:opacity-50"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Enviar Comanda a Cocina & Barra</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal before closing & liberating table */}
      <ConfirmModal
        isOpen={!!tableToClose}
        title="¿Estás seguro que quieres eliminar o cerrar la cuenta de esta mesa?"
        itemName={tableToClose ? `Mesa #${tableToClose.number} - Consumo: $${(tableToClose.activeOrderTotal || 0).toLocaleString('es-AR')}` : undefined}
        description="Se procesará el cobro del consumo acumulado y la mesa pasará a estar disponible y desocupada en el salón."
        confirmText="Sí, cobrar y liberar"
        cancelText="Volver"
        isDestructive={false}
        onConfirm={() => {
          if (tableToClose) {
            onCloseTableBill(tableToClose.id);
            setTableToClose(null);
          }
        }}
        onCancel={() => setTableToClose(null)}
      />

      {/* Confirmation Modal before removing item from cart */}
      <ConfirmModal
        isOpen={!!itemToRemoveFromCart}
        title="¿Estás seguro que quieres eliminar?"
        itemName={itemToRemoveFromCart ? `${itemToRemoveFromCart.quantity}x ${itemToRemoveFromCart.name}` : undefined}
        description="Este plato será quitado de la comanda en preparación y no se enviará a cocina ni barra."
        confirmText="Sí, quitar de comanda"
        cancelText="Cancelar"
        onConfirm={() => {
          if (itemToRemoveFromCart) {
            setOrderCart(orderCart.filter((i) => i.productId !== itemToRemoveFromCart.productId));
            setItemToRemoveFromCart(null);
          }
        }}
        onCancel={() => setItemToRemoveFromCart(null)}
      />
    </div>
  );
};
