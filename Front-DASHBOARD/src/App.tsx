import React, { useState, useEffect, useRef } from 'react';
import {
  INITIAL_RESTAURANT,
  INITIAL_APPEARANCE,
  PALETTE_PRESETS,
  INITIAL_CATEGORIES,
  INITIAL_SUBCATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_TABLES,
  INITIAL_ORDERS,
  INITIAL_STOCK,
  USERS,
  INITIAL_PAYMENT_CONFIG,
  INITIAL_TRANSACTIONS,
  INITIAL_SUPPLIERS,
  INITIAL_SHIFTS,
} from './mockData';
import {
  RestaurantProfileData,
  AppearanceSettings,
  Category,
  SubCategory,
  Product,
  Table,
  Order,
  StockItem,
  User,
  PaymentConfig,
  Transaction,
  OrderStatus,
  Reservation,
  Supplier,
  ShiftRecord,
} from './types';
import { Sidebar, NavTab } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { RestaurantProfile } from './components/admin/RestaurantProfile';
import { MenuManager } from './components/admin/MenuManager';
import { AppearanceCustomizer } from './components/admin/AppearanceCustomizer';
import { FloorPlanManager } from './components/admin/FloorPlanManager';
import { AnalyticsView } from './components/admin/AnalyticsView';
import { StockInventory } from './components/admin/StockInventory';
import { PaymentGateway } from './components/admin/PaymentGateway';
import { UserManager } from './components/admin/UserManager';
import { SuppliersManager } from './components/admin/SuppliersManager';
import { TablesView } from './components/operations/TablesView';
import { ComandasView } from './components/operations/ComandasView';
import { ShiftsManager } from './components/operations/ShiftsManager';
import { UserProfile } from './components/profile/UserProfile';
import { QRPrintModal } from './components/QRPrintModal';
import { CustomerMenuModal } from './components/CustomerMenuModal';
import { StockAlertToast } from './components/notifications/StockAlertToast';
import { ShieldAlert, ArrowLeftRight, Check } from 'lucide-react';

export default function App() {
  // App state
  const [currentUserIndex, setCurrentUserIndex] = useState(0); // 0 = Agustín (Superadmin), 1 = Lucas (Operativo)
  const [currentTab, setCurrentTab] = useState<NavTab>('restaurant');

  const [restaurant, setRestaurant] = useState<RestaurantProfileData>(INITIAL_RESTAURANT);
  const [appearance, setAppearance] = useState<AppearanceSettings>(INITIAL_APPEARANCE);
  const [categories, setCategories] = useState<Category[]>(INITIAL_CATEGORIES);
  const [subCategories, setSubCategories] = useState<SubCategory[]>(INITIAL_SUBCATEGORIES);
  const [products, setProducts] = useState<Product[]>(INITIAL_PRODUCTS);
  const [tables, setTables] = useState<Table[]>(INITIAL_TABLES);
  const [orders, setOrders] = useState<Order[]>(INITIAL_ORDERS);
  const [stock, setStock] = useState<StockItem[]>(INITIAL_STOCK);
  const [suppliers, setSuppliers] = useState<Supplier[]>(INITIAL_SUPPLIERS);
  const [shifts, setShifts] = useState<ShiftRecord[]>(INITIAL_SHIFTS);
  const [paymentConfig, setPaymentConfig] = useState<PaymentConfig>(INITIAL_PAYMENT_CONFIG);
  const [transactions, setTransactions] = useState<Transaction[]>(INITIAL_TRANSACTIONS);
  const [usersList, setUsersList] = useState<User[]>(USERS);

  // Modals state
  const [isQRPrintOpen, setIsQRPrintOpen] = useState(false);
  const [isCustomerMenuOpen, setIsCustomerMenuOpen] = useState(false);
  const [roleNotice, setRoleNotice] = useState<string | null>(null);

  // Proactive low stock detection (quantity <= minThreshold or status 'bajo' / 'critico')
  const lowStockItems = stock.filter(
    (s) => s.quantity <= s.minThreshold || s.status === 'bajo' || s.status === 'critico'
  );
  const lowStockCount = lowStockItems.length;
  const [isStockAlertDismissed, setIsStockAlertDismissed] = useState(false);
  const prevLowStockCountRef = useRef(lowStockCount);

  // Re-open notification if any new product drops below threshold
  useEffect(() => {
    if (lowStockCount > prevLowStockCountRef.current) {
      setIsStockAlertDismissed(false);
    }
    prevLowStockCountRef.current = lowStockCount;
  }, [lowStockCount]);

  const currentUser = usersList[currentUserIndex] || USERS[0];
  const isSuperAdmin = currentUser.role === 'superadmin';

  // Suppliers handlers
  const handleAddSupplier = (newSup: Omit<Supplier, 'id'>) => {
    setSuppliers((prev) => [{ ...newSup, id: `sup-${Date.now()}` }, ...prev]);
  };

  const handleUpdateSupplier = (updated: Supplier) => {
    setSuppliers((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  const handleDeleteSupplier = (id: string) => {
    setSuppliers((prev) => prev.filter((s) => s.id !== id));
  };

  // Shifts handlers
  const handleOpenShift = (
    shiftName: ShiftRecord['shiftName'],
    initialCash: number,
    cashierName: string
  ) => {
    const newShift: ShiftRecord = {
      id: `shf-${Date.now()}`,
      shiftName,
      date: new Date().toISOString().split('T')[0],
      openedAt:
        new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) + ' hs',
      status: 'abierto',
      cashierName,
      initialCash,
      totalSales: 0,
      totalOrders: 0,
      activeStaffCount: usersList.filter((u) => u.shiftActive).length,
    };
    setShifts((prev) => [newShift, ...prev]);
  };

  const handleCloseShift = (shiftId: string) => {
    setShifts((prev) =>
      prev.map((s) =>
        s.id === shiftId
          ? {
              ...s,
              status: 'cerrado',
              closedAt:
                new Date().toLocaleTimeString('es-AR', {
                  hour: '2-digit',
                  minute: '2-digit',
                }) + ' hs',
            }
          : s
      )
    );
  };

  // Role safety handler
  const handleSelectTab = (tab: NavTab) => {
    const adminTabs: NavTab[] = [
      'restaurant',
      'menu',
      'appearance',
      'floorplan',
      'analytics',
      'stock',
      'suppliers',
      'payments',
      'team',
    ];

    if (!isSuperAdmin && adminTabs.includes(tab)) {
      setRoleNotice(
        `Acceso restringido: Solo los Super Administradores pueden gestionar la sección de ${tab}. Tu perfil operativo está asignado a Operaciones y Perfil.`
      );
      setTimeout(() => setRoleNotice(null), 4000);
      return;
    }

    setCurrentTab(tab);
  };

  const handleSwitchUserRole = () => {
    const nextIdx = (currentUserIndex + 1) % usersList.length;
    setCurrentUserIndex(nextIdx);
    const nextUser = usersList[nextIdx];

    // If next user is operativo and current tab is admin, switch to 'tables'
    const adminTabs: NavTab[] = [
      'restaurant',
      'menu',
      'appearance',
      'floorplan',
      'analytics',
      'stock',
      'suppliers',
      'payments',
      'team',
    ];
    if (nextUser.role === 'operativo' && adminTabs.includes(currentTab)) {
      setCurrentTab('tables');
    }

    setRoleNotice(
      `Sesión cambiada a: ${nextUser.name} (${nextUser.role === 'superadmin' ? 'Super Administrador' : 'Operativo'})`
    );
    setTimeout(() => setRoleNotice(null), 3000);
  };

  // Operation Handlers
  const handleUpdateOrderStatus = (orderId: string, newStatus: OrderStatus) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
    );
  };

  const handleCreateOrderFromTable = (
    newOrderData: Omit<Order, 'id' | 'createdAt' | 'elapsedMinutes'>
  ) => {
    const newOrder: Order = {
      ...newOrderData,
      id: `ord-${Date.now()}`,
      createdAt: 'Recién',
      elapsedMinutes: 0,
    };
    setOrders((prev) => [newOrder, ...prev]);
  };

  const handleCloseTableBill = (tableId: string) => {
    const tbl = tables.find((t) => t.id === tableId);
    if (!tbl) return;

    if (tbl.activeOrderTotal && tbl.activeOrderTotal > 0) {
      const newTx: Transaction = {
        id: `tx-${Date.now()}`,
        orderCode: `#M${tbl.number}-${Math.floor(100 + Math.random() * 900)}`,
        channel: 'mesa',
        amount: tbl.activeOrderTotal,
        method: 'Tarjeta Crédito/Débito',
        status: 'completado',
        timestamp: 'Hoy, Recién',
      };
      setTransactions((prev) => [newTx, ...prev]);
    }

    setTables((prev) =>
      prev.map((t) =>
        t.id === tableId
          ? {
              ...t,
              status: 'libre',
              activeOrderId: undefined,
              activeOrderTotal: 0,
              seatedMinutes: 0,
              currentReservation: undefined,
            }
          : t
      )
    );
  };

  const handleUpdateTable = (updatedTable: Table) => {
    setTables((prev) =>
      prev.map((t) => (t.id === updatedTable.id ? updatedTable : t))
    );
  };

  const handleAddTable = (tableData: Omit<Table, 'id'>) => {
    const newTable: Table = {
      ...tableData,
      id: `tbl-${Date.now()}`,
    };
    setTables((prev) => [...prev, newTable]);
  };

  const handleRemoveTable = (id: string) => {
    setTables((prev) => prev.filter((t) => t.id !== id));
  };

  const handleSaveReservation = (res: Reservation) => {
    setTables((prev) =>
      prev.map((t) =>
        t.number === res.tableNumber
          ? { ...t, status: 'reservada', currentReservation: res }
          : t
      )
    );
  };

  const handleRestock = (id: string, addedQty: number) => {
    setStock((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const newQty = Number((s.quantity + addedQty).toFixed(2));
          const isCrit = newQty < s.minThreshold * 0.7;
          const isLow = newQty <= s.minThreshold;
          return {
            ...s,
            quantity: newQty,
            status: isCrit ? 'critico' : isLow ? 'bajo' : 'optimo',
            lastRestocked: new Date().toISOString().split('T')[0],
          };
        }
        return s;
      })
    );
  };

  const handleAdjustStock = (id: string, deltaQty: number) => {
    setStock((prev) =>
      prev.map((s) => {
        if (s.id === id) {
          const newQty = Math.max(0, Number((s.quantity + deltaQty).toFixed(2)));
          const isCrit = newQty < s.minThreshold * 0.7;
          const isLow = newQty <= s.minThreshold;
          return {
            ...s,
            quantity: newQty,
            status: isCrit ? 'critico' : isLow ? 'bajo' : 'optimo',
            lastRestocked: deltaQty > 0 ? new Date().toISOString().split('T')[0] : s.lastRestocked,
          };
        }
        return s;
      })
    );
  };

  const handleToggleShift = (userId?: string) => {
    const targetId = userId || currentUser.id;
    setUsersList((prev) =>
      prev.map((u) => {
        if (u.id === targetId) {
          const nextShift = !u.shiftActive;
          return {
            ...u,
            shiftActive: nextShift,
            shiftStartTime: nextShift ? 'Recién iniciado (0m)' : undefined,
          };
        }
        return u;
      })
    );
  };

  const handleDeleteStockItem = (id: string) => {
    setStock((prev) => prev.filter((s) => s.id !== id));
  };

  const handleDeleteUser = (userId: string) => {
    setUsersList((prev) => prev.filter((u) => u.id !== userId));
  };

  const pendingOrdersCount = orders.filter((o) => o.status !== 'entregado').length;
  const occupiedTablesCount = tables.filter((t) => t.status === 'ocupada').length;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-neutral-100/80 font-jakarta text-neutral-900 antialiased">
      {/* 3-Section Minimalist Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        currentUser={currentUser}
        pendingOrdersCount={pendingOrdersCount}
        occupiedTablesCount={occupiedTablesCount}
        lowStockCount={lowStockCount}
        onLogout={() => {
          setRoleNotice('Has cerrado sesión correctamente.');
          setTimeout(() => setRoleNotice(null), 3000);
        }}
        onSwitchUser={handleSwitchUserRole}
      />

      {/* Main Content Workspace */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar complying with strict 1-row 3-zone contract */}
        {currentTab !== 'appearance' && (
          <TopBar
            currentTab={currentTab}
            restaurantName={restaurant.name}
            currentUser={currentUser}
            onOpenCustomerMenu={() => setIsCustomerMenuOpen(true)}
            onSwitchUserRole={handleSwitchUserRole}
            orderReceptionEnabled={restaurant.orderReceptionEnabled}
          />
        )}

        {/* Floating Notification / Role Notice */}
        {roleNotice && (
          <div className="bg-neutral-900 text-white px-4 py-2.5 text-xs flex items-center justify-between border-b border-neutral-800 animate-in slide-in-from-top duration-150">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
              <span>{roleNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setRoleNotice(null)}
              className="text-neutral-400 hover:text-white text-xs ml-4"
            >
              Entendido
            </button>
          </div>
        )}

        {/* Viewport Area */}
        <main
          className={`flex-1 min-h-0 ${
            currentTab === 'appearance'
              ? 'h-full overflow-hidden p-0'
              : 'overflow-y-auto p-4 md:p-6 lg:p-8'
          }`}
        >
          {/* ADMINISTRATIVAS */}
          {currentTab === 'restaurant' && isSuperAdmin && (
            <RestaurantProfile
              restaurant={restaurant}
              onUpdate={(data) => setRestaurant((prev) => ({ ...prev, ...data }))}
              onOpenQRPrint={() => setIsQRPrintOpen(true)}
              onOpenCustomerPreview={() => setIsCustomerMenuOpen(true)}
            />
          )}

          {currentTab === 'menu' && isSuperAdmin && (
            <MenuManager
              categories={categories}
              subCategories={subCategories}
              products={products}
              onAddCategory={(cat) =>
                setCategories((prev) => [
                  ...prev,
                  { ...cat, id: `cat-${Date.now()}`, order: prev.length + 1 },
                ])
              }
              onAddSubCategory={(sub) =>
                setSubCategories((prev) => [
                  ...prev,
                  { ...sub, id: `sub-${Date.now()}` },
                ])
              }
              onSaveProduct={(prod) =>
                setProducts((prev) => {
                  const exists = prev.some((p) => p.id === prod.id);
                  if (exists) {
                    return prev.map((p) => (p.id === prod.id ? prod : p));
                  }
                  return [prod, ...prev];
                })
              }
              onDeleteProduct={(id) =>
                setProducts((prev) => prev.filter((p) => p.id !== id))
              }
            />
          )}

          {currentTab === 'appearance' && isSuperAdmin && (
            <AppearanceCustomizer
              appearance={appearance}
              palettes={PALETTE_PRESETS}
              products={products}
              categories={categories}
              restaurantName={restaurant.name}
              onSave={(settings) => setAppearance(settings)}
            />
          )}

          {currentTab === 'floorplan' && isSuperAdmin && (
            <FloorPlanManager
              tables={tables}
              onUpdateTable={handleUpdateTable}
              onAddTable={handleAddTable}
              onRemoveTable={handleRemoveTable}
              onSaveReservation={handleSaveReservation}
            />
          )}

          {currentTab === 'analytics' && isSuperAdmin && (
            <AnalyticsView orders={orders} />
          )}

          {currentTab === 'stock' && isSuperAdmin && (
            <StockInventory
              stockItems={stock}
              onRestock={handleRestock}
              onAdjustStock={handleAdjustStock}
              onAddNewStockItem={(item) =>
                setStock((prev) => {
                  const isCrit = item.quantity < item.minThreshold * 0.7;
                  const isLow = item.quantity <= item.minThreshold;
                  return [
                    {
                      ...item,
                      id: `stk-${Date.now()}`,
                      status: isCrit ? 'critico' : isLow ? 'bajo' : 'optimo',
                      lastRestocked: new Date().toISOString().split('T')[0],
                    },
                    ...prev,
                  ];
                })
              }
              onBatchAddStockItems={(items) =>
                setStock((prev) => {
                  const today = new Date().toISOString().split('T')[0];
                  const created: StockItem[] = items.map((item, idx) => {
                    const isCrit = item.quantity < item.minThreshold * 0.7;
                    const isLow = item.quantity <= item.minThreshold;
                    return {
                      ...item,
                      id: `stk-${Date.now()}-${idx}`,
                      status: isCrit ? 'critico' : isLow ? 'bajo' : 'optimo',
                      lastRestocked: today,
                    };
                  });
                  return [...created, ...prev];
                })
              }
              onDeleteStockItem={handleDeleteStockItem}
            />
          )}

          {currentTab === 'suppliers' && isSuperAdmin && (
            <SuppliersManager
              suppliers={suppliers}
              onAddSupplier={handleAddSupplier}
              onUpdateSupplier={handleUpdateSupplier}
              onDeleteSupplier={handleDeleteSupplier}
            />
          )}

          {currentTab === 'payments' && isSuperAdmin && (
            <PaymentGateway
              config={paymentConfig}
              transactions={transactions}
              onUpdateConfig={(cfg) =>
                setPaymentConfig((prev) => ({ ...prev, ...cfg }))
              }
              onRecordTransaction={(tx) =>
                setTransactions((prev) => [tx, ...prev])
              }
            />
          )}

          {currentTab === 'team' && isSuperAdmin && (
            <UserManager
              users={usersList}
              currentUserId={currentUser.id}
              onAddUser={(usr) =>
                setUsersList((prev) => [
                  ...prev,
                  { ...usr, id: `usr-${Date.now()}` },
                ])
              }
              onToggleShift={(userId) => handleToggleShift(userId)}
              onDeleteUser={handleDeleteUser}
            />
          )}

          {/* OPERATIVAS */}
          {currentTab === 'tables' && (
            <TablesView
              tables={tables}
              orders={orders}
              products={products}
              categories={categories}
              currentUserName={currentUser.name}
              onUpdateTable={handleUpdateTable}
              onCreateOrderFromTable={handleCreateOrderFromTable}
              onCloseTableBill={handleCloseTableBill}
            />
          )}

          {currentTab === 'orders' && (
            <ComandasView
              orders={orders}
              onUpdateOrderStatus={handleUpdateOrderStatus}
            />
          )}

          {currentTab === 'shifts' && (
            <ShiftsManager
              shifts={shifts}
              activeStaff={usersList}
              onOpenShift={handleOpenShift}
              onCloseShift={handleCloseShift}
            />
          )}

          {/* PERSONAL */}
          {currentTab === 'profile' && (
            <UserProfile
              user={currentUser}
              onToggleShift={() => handleToggleShift(currentUser.id)}
              onLogout={() => {
                setRoleNotice('Has cerrado sesión correctamente.');
                setTimeout(() => setRoleNotice(null), 3000);
              }}
              onSwitchUser={handleSwitchUserRole}
            />
          )}
        </main>
      </div>

      {/* QR Printable Table Card Modal */}
      <QRPrintModal
        isOpen={isQRPrintOpen}
        onClose={() => setIsQRPrintOpen(false)}
        restaurant={restaurant}
        publicMenuUrl={restaurant.publicMenuUrl}
      />

      {/* Real-time Customer Diner Menu Simulator */}
      <CustomerMenuModal
        isOpen={isCustomerMenuOpen}
        onClose={() => setIsCustomerMenuOpen(false)}
        restaurant={restaurant}
        appearance={appearance}
        categories={categories}
        products={products}
        palettes={PALETTE_PRESETS}
      />

      {/* Floating Proactive Stock Alert Notification Toast */}
      {isSuperAdmin && (
        <StockAlertToast
          lowStockItems={lowStockItems}
          onViewStock={() => {
            setCurrentTab('stock');
            setIsStockAlertDismissed(false);
          }}
          onDismiss={() => setIsStockAlertDismissed(true)}
          isDismissed={isStockAlertDismissed}
          onReopen={() => setIsStockAlertDismissed(false)}
        />
      )}
    </div>
  );
}
