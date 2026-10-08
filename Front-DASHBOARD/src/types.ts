export type UserRole = 'superadmin' | 'operativo';

export type UserPosition =
  | 'Super Administrador'
  | 'Gerente General'
  | 'Mozo / Camarero'
  | 'Bartender'
  | 'Jefe de Cocina'
  | 'Cajero';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  position: UserPosition;
  avatarUrl: string;
  shiftActive: boolean;
  shiftStartTime?: string;
  tablesAssigned?: number[];
  pin?: string;
}

export interface RestaurantProfileData {
  name: string;
  slug: string;
  description: string;
  logoUrl: string;
  phone: string;
  address: string;
  hours: string;
  orderReceptionEnabled: boolean;
  publicMenuId: string;
  publicMenuUrl: string;
}

export type FontFamilyChoice =
  | 'satoshi'
  | 'bebas'
  | 'playfair'
  | 'lilita'
  | 'montserrat'
  | 'alegreya'
  | 'quicksand'
  | 'syne'
  | 'jakarta';

export type ThemeMode = 'light' | 'dark';

export interface PalettePreset {
  id: string;
  name: string;
  description: string;
  primary: string;
  secondary: string;
  accent: string;
  backgroundLight: string;
  backgroundDark: string;
  surfaceLight: string;
  surfaceDark: string;
  textPrimaryLight: string;
  textPrimaryDark: string;
  textSecondaryLight: string;
  textSecondaryDark: string;
  isHighContrastCertified: boolean;
}

export interface AppearanceSettings {
  fontFamily: FontFamilyChoice;
  themeMode: ThemeMode;
  paletteId: string;
  heroMediaType: 'image' | 'video';
  heroMediaUrl: string;
  heroHeadline: string;
  heroSubheadline: string;
}

export interface Category {
  id: string;
  name: string;
  type: 'Comida' | 'Bebida' | 'Postre' | 'Especial';
  order: number;
}

export interface SubCategory {
  id: string;
  categoryId: string;
  name: string;
}

export interface Product {
  id: string;
  categoryId: string;
  subCategoryId?: string;
  name: string;
  description: string;
  price: number;
  imageUrl: string;
  isSpicy?: boolean;
  isGlutenFree?: boolean;
  isVegetarian?: boolean;
  isFeatured?: boolean;
  featuredTitle?: string;
  featuredDiscount?: number; // e.g. 15 for 15% off
  available: boolean;
}

export type TableShape = 'square' | 'round' | 'rectangle';
export type TableStatus = 'libre' | 'ocupada' | 'cuenta' | 'reservada';

export interface Reservation {
  id: string;
  tableNumber: number;
  customerName: string;
  customerPhone: string;
  time: string;
  guests: number;
  notes?: string;
}

export interface Table {
  id: string;
  number: number;
  capacity: number;
  shape: TableShape;
  x: number; // Percentage in floor plan
  y: number; // Percentage in floor plan
  status: TableStatus;
  activeOrderId?: string;
  activeOrderTotal?: number;
  waiterName?: string;
  seatedMinutes?: number;
  currentReservation?: Reservation;
}

export type OrderChannel = 'mesa' | 'takeaway' | 'delivery';
export type OrderStatus = 'pendiente' | 'preparacion' | 'listo' | 'entregado';
export type OrderPriority = 'normal' | 'alta' | 'urgente';

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  notes?: string;
}

export interface Order {
  id: string;
  code: string;
  channel: OrderChannel;
  tableNumber?: number;
  customerName?: string;
  deliveryAddress?: string;
  courierNotes?: string;
  items: OrderItem[];
  status: OrderStatus;
  priority: OrderPriority;
  createdAt: string;
  elapsedMinutes: number;
  total: number;
  waiterName?: string;
}

export interface StockItem {
  id: string;
  name: string;
  category: 'Carnes & Pescados' | 'Verduras & Frescos' | 'Almacén & Secos' | 'Lácteos' | 'Bebidas & Licores';
  quantity: number;
  unit: 'kg' | 'g' | 'l' | 'unidades' | 'botellas';
  minThreshold: number;
  costPerUnit: number;
  status: 'optimo' | 'bajo' | 'critico';
  lastRestocked: string;
}

export interface PaymentConfig {
  provider: 'stripe' | 'mercadopago' | 'pos_terminal';
  mode: 'test' | 'live';
  apiKeyMasked: string;
  isConnected: boolean;
  terminalModel: string;
  webhookStatus: 'active' | 'inactive';
}

export interface Transaction {
  id: string;
  orderCode: string;
  channel: OrderChannel;
  amount: number;
  method: 'Tarjeta Crédito/Débito' | 'QR MercadoPago' | 'Efectivo' | 'Stripe Checkout';
  status: 'completado' | 'procesando' | 'reembolsado';
  timestamp: string;
}

export interface Supplier {
  id: string;
  name: string;
  category: 'Carnes & Pescados' | 'Verduras & Frescos' | 'Almacén & Secos' | 'Lácteos' | 'Bebidas & Licores' | 'Insumos Generales';
  contactPerson: string;
  phone: string;
  email: string;
  address?: string;
  deliveryDays: string;
  paymentTerms: string;
  notes?: string;
  status: 'activo' | 'inactivo';
}

export interface ShiftRecord {
  id: string;
  shiftName: 'Turno Mañana' | 'Turno Tarde' | 'Turno Noche';
  date: string;
  openedAt: string;
  closedAt?: string;
  status: 'abierto' | 'cerrado';
  cashierName: string;
  initialCash: number;
  totalSales: number;
  totalOrders: number;
  activeStaffCount: number;
}
