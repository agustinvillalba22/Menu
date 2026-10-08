import React, { useState, useEffect } from 'react';
import {
  X,
  Flame,
  WheatOff,
  Leaf,
  Sparkles,
  Search,
  CheckCircle,
  Play,
  ExternalLink,
  QrCode,
  Globe,
  Smartphone,
  Copy,
  Check
} from 'lucide-react';
import {
  RestaurantProfileData,
  AppearanceSettings,
  Category,
  Product,
  PalettePreset
} from '../types';
import { generateQRDataURL } from '../utils/qr';

interface CustomerMenuModalProps {
  isOpen: boolean;
  onClose: () => void;
  restaurant: RestaurantProfileData;
  appearance: AppearanceSettings;
  categories: Category[];
  products: Product[];
  palettes: PalettePreset[];
}

export const CustomerMenuModal: React.FC<CustomerMenuModalProps> = ({
  isOpen,
  onClose,
  restaurant,
  appearance,
  categories,
  products,
  palettes,
}) => {
  const [viewMode, setViewMode] = useState<'linked' | 'simulator'>('linked');
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cartCount, setCartCount] = useState(0);
  const [orderNotice, setOrderNotice] = useState<string | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<string>('');

  const linkedProjectUrl =
    restaurant.publicMenuUrl ||
    `https://aistudio.google.com/apps/${restaurant.publicMenuId}?showPreview=true&showAssistant=true`;

  useEffect(() => {
    if (isOpen) {
      generateQRDataURL(linkedProjectUrl).then(setQrCodeData);
    }
  }, [isOpen, linkedProjectUrl]);

  if (!isOpen) return null;

  const currentPalette =
    palettes.find((p) => p.id === appearance.paletteId) || palettes[0];
  const isDark = appearance.themeMode === 'dark';

  const fontClass =
    appearance.fontFamily === 'montserrat'
      ? 'font-montserrat'
      : appearance.fontFamily === 'alegreya'
      ? 'font-alegreya'
      : appearance.fontFamily === 'quicksand'
      ? 'font-quicksand'
      : appearance.fontFamily === 'syne'
      ? 'font-syne'
      : 'font-jakarta';

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCatId === 'all' || p.categoryId === selectedCatId;
    const matchSearch =
      searchQuery.trim() === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch && p.available;
  });

  const featuredDishes = products.filter((p) => p.isFeatured && p.available);

  const handleAddToCart = (dishName: string) => {
    setCartCount((prev) => prev + 1);
    setOrderNotice(`"${dishName}" agregado al pedido`);
    setTimeout(() => setOrderNotice(null), 2500);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(linkedProjectUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-neutral-950/75 backdrop-blur-xs flex items-center justify-center p-3 md:p-6 animate-in fade-in duration-150">
      <div className="bg-neutral-900 border border-neutral-800 rounded-2xl w-full max-w-5xl h-[92vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Top simulated browser/device bar */}
        <div className="px-4 py-2.5 bg-neutral-950 border-b border-neutral-800 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500/80 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80 shrink-0" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80 shrink-0" />

            {/* URL input bar */}
            <div className="ml-2 px-3 py-1 bg-neutral-900 border border-neutral-800 rounded-md text-[11px] text-neutral-300 font-mono flex items-center gap-2 max-w-md md:max-w-lg truncate">
              <Globe className="w-3 h-3 text-neutral-500 shrink-0" />
              <span className="truncate">{linkedProjectUrl}</span>
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              className="p-1 text-neutral-400 hover:text-white rounded hover:bg-neutral-800"
              title="Copiar URL"
            >
              {copiedLink ? (
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </button>
          </div>

          {/* Segment View Selector */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex rounded-lg border border-neutral-800 p-0.5 bg-neutral-900 text-xs">
              <button
                type="button"
                onClick={() => setViewMode('linked')}
                className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === 'linked'
                    ? 'bg-neutral-800 text-white font-medium shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Globe className="w-3.5 h-3.5 text-amber-400" />
                <span>Menú Vinculado</span>
              </button>

              <button
                type="button"
                onClick={() => setViewMode('simulator')}
                className={`px-3 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
                  viewMode === 'simulator'
                    ? 'bg-neutral-800 text-white font-medium shadow-xs'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Smartphone className="w-3.5 h-3.5 text-blue-400" />
                <span>Vista Móvil</span>
              </button>
            </div>

            <a
              href={linkedProjectUrl}
              target="_blank"
              rel="noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-neutral-800 hover:bg-neutral-700 rounded-md border border-neutral-700 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Abrir Proyecto</span>
            </a>

            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* View Mode 1: MENÚ VINCULADO (PROYECTO AI STUDIO) */}
        {viewMode === 'linked' && (
          <div className="flex-1 flex flex-col bg-neutral-950 overflow-hidden relative">
            {/* Top Info Bar for the linked project */}
            <div className="px-6 py-3 bg-neutral-900/90 border-b border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold text-xs">
                  AI
                </div>
                <div>
                  <h2 className="text-xs font-bold text-neutral-100 flex items-center gap-2">
                    <span>Menú Oficial del Proyecto Vinculado</span>
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono">
                      Sincronizado
                    </span>
                  </h2>
                  <p className="text-[11px] text-neutral-400 font-mono">
                    ID de Applet: {restaurant.publicMenuId}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href={linkedProjectUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-neutral-900 bg-amber-400 hover:bg-amber-300 rounded-lg transition-colors shadow-sm"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Abrir Menú en Pantalla Completa</span>
                </a>
              </div>
            </div>

            {/* Embedded Iframe and Quick Scan Hub */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
              {/* Iframe Viewport (8 cols) */}
              <div className="lg:col-span-8 h-full bg-neutral-900 flex flex-col relative border-r border-neutral-800">
                <iframe
                  src={linkedProjectUrl}
                  title="Menú Vinculado Proyecto AI Studio"
                  className="w-full h-full border-0 bg-white"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />

                {/* Overlay helper banner if browser denies frame */}
                <div className="absolute bottom-4 left-4 right-4 p-3 bg-neutral-900/95 backdrop-blur-md rounded-xl border border-neutral-800 flex items-center justify-between text-xs text-neutral-300 shadow-xl">
                  <span className="truncate mr-2">
                    ¿Quieres interactuar sin restricciones de marco?
                  </span>
                  <a
                    href={linkedProjectUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-1 bg-white text-neutral-900 font-semibold rounded-md hover:bg-neutral-100 shrink-0 inline-flex items-center gap-1"
                  >
                    <ExternalLink className="w-3 h-3" />
                    <span>Abrir Directamente</span>
                  </a>
                </div>
              </div>

              {/* QR and Mobile Connection Hub (4 cols) */}
              <div className="lg:col-span-4 p-6 bg-neutral-950 flex flex-col items-center justify-center text-center space-y-4 overflow-y-auto">
                <div className="p-3 bg-white rounded-2xl shadow-xl border border-neutral-800 flex items-center justify-center">
                  {qrCodeData ? (
                    <img
                      src={qrCodeData}
                      alt="Código QR del Menú Vinculado"
                      className="w-48 h-48 object-contain"
                    />
                  ) : (
                    <div className="w-48 h-48 flex items-center justify-center text-xs text-neutral-500">
                      Cargando QR...
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <h3 className="text-sm font-semibold text-neutral-200">
                    Escanear desde tu Móvil
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
                    Apunta con la cámara de tu teléfono a este código QR para abrir el menú del proyecto directamente en tu smartphone.
                  </p>
                </div>

                <div className="w-full pt-2 border-t border-neutral-800/80 space-y-2">
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-300 bg-neutral-900 hover:bg-neutral-800 rounded-lg border border-neutral-800 transition-colors"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-400" />
                        <span>¡Enlace Copiado al Portapapeles!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copiar Enlace del Menú</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => setViewMode('simulator')}
                    className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-neutral-400 hover:text-neutral-200 transition-colors"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Ver simulación de diseño alternativa</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View Mode 2: VISTA MÓVIL SIMULADOR */}
        {viewMode === 'simulator' && (
          <div
            className={`flex-1 overflow-y-auto ${fontClass} transition-colors duration-200`}
            style={{
              backgroundColor: isDark
                ? currentPalette.backgroundDark
                : currentPalette.backgroundLight,
              color: isDark
                ? currentPalette.textPrimaryDark
                : currentPalette.textPrimaryLight,
            }}
          >
            {/* Header Banner / Hero Media */}
            <div className="relative w-full h-56 md:h-64 overflow-hidden bg-neutral-900">
              {appearance.heroMediaType === 'video' ? (
                <div className="w-full h-full relative">
                  <video
                    autoPlay
                    loop
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                    src={
                      appearance.heroMediaUrl ||
                      'https://assets.mixkit.co/videos/preview/mixkit-chef-plating-a-dish-in-a-restaurant-kitchen-42774-large.mp4'
                    }
                  />
                  <div className="absolute top-3 right-3 px-2 py-1 bg-black/60 backdrop-blur-xs rounded text-[10px] text-white flex items-center gap-1">
                    <Play className="w-2.5 h-2.5" /> Video Hero
                  </div>
                </div>
              ) : (
                <img
                  src={appearance.heroMediaUrl}
                  alt="Restaurant Ambience"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLElement).style.display = 'none';
                  }}
                />
              )}
              {/* Scrim Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/40 to-transparent" />

              {/* Restaurant Info on Hero */}
              <div className="absolute bottom-4 left-6 right-6 flex items-end justify-between">
                <div className="flex items-center gap-3">
                  {restaurant.logoUrl && (
                    <img
                      src={restaurant.logoUrl}
                      alt={restaurant.name}
                      referrerPolicy="no-referrer"
                      className="w-14 h-14 rounded-full object-cover border-2 border-white/20 shadow-md bg-neutral-900"
                    />
                  )}
                  <div>
                    <h1 className="text-xl md:text-2xl font-bold text-white tracking-tight">
                      {restaurant.name}
                    </h1>
                    <p className="text-xs text-neutral-300 max-w-md line-clamp-1">
                      {restaurant.description}
                    </p>
                  </div>
                </div>
                <div className="hidden sm:block text-right text-xs text-neutral-300">
                  <p>{restaurant.address}</p>
                  <p className="text-neutral-400 font-mono text-[11px]">{restaurant.hours}</p>
                </div>
              </div>
            </div>

            {/* Toast Notification when adding item */}
            {orderNotice && (
              <div className="sticky top-2 z-30 mx-auto max-w-sm px-4 py-2 bg-neutral-900 text-white text-xs rounded-lg shadow-lg border border-neutral-700 flex items-center justify-between animate-in slide-in-from-top duration-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                  <span>{orderNotice}</span>
                </div>
                <span className="font-semibold text-amber-300 tabular-nums">
                  Cart ({cartCount})
                </span>
              </div>
            )}

            {/* Content Body */}
            <div className="max-w-4xl mx-auto px-6 py-6 space-y-8">
              {/* Featured Cards (Promotions / Highlights) */}
              {featuredDishes.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Sparkles
                      className="w-4 h-4"
                      style={{ color: currentPalette.secondary }}
                    />
                    <h2 className="text-sm font-semibold tracking-wide uppercase">
                      Destacados del Chef & Recomendaciones
                    </h2>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {featuredDishes.map((dish) => (
                      <div
                        key={dish.id}
                        className="rounded-xl overflow-hidden border transition-all duration-200 flex flex-col justify-between"
                        style={{
                          backgroundColor: isDark
                            ? currentPalette.surfaceDark
                            : currentPalette.surfaceLight,
                          borderColor: isDark
                            ? 'rgba(255,255,255,0.08)'
                            : 'rgba(0,0,0,0.08)',
                        }}
                      >
                        <div className="relative h-44 overflow-hidden bg-neutral-800">
                          <img
                            src={dish.imageUrl}
                            alt={dish.name}
                            referrerPolicy="no-referrer"
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                          />
                          {dish.featuredTitle && (
                            <div className="absolute top-2.5 left-2.5 px-2 py-0.5 rounded text-[11px] font-medium bg-black/75 text-white backdrop-blur-xs">
                              {dish.featuredTitle}
                            </div>
                          )}
                          {dish.featuredDiscount && (
                            <div
                              className="absolute top-2.5 right-2.5 px-2 py-0.5 rounded text-[11px] font-bold text-white shadow-xs"
                              style={{ backgroundColor: currentPalette.secondary }}
                            >
                              {dish.featuredDiscount}% OFF
                            </div>
                          )}
                        </div>

                        <div className="p-4 flex-1 flex flex-col justify-between">
                          <div>
                            <div className="flex items-start justify-between gap-2">
                              <h3 className="font-semibold text-sm leading-tight">
                                {dish.name}
                              </h3>
                              <span
                                className="font-mono font-bold text-sm tabular-nums whitespace-nowrap"
                                style={{ color: currentPalette.secondary }}
                              >
                                ${dish.price.toLocaleString('es-AR')}
                              </span>
                            </div>
                            <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                              {dish.description}
                            </p>
                          </div>

                          <div className="mt-3 pt-3 border-t border-neutral-500/10 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-neutral-400">
                              {dish.isVegetarian && (
                                <span className="flex items-center gap-1 text-emerald-500">
                                  <Leaf className="w-3 h-3" /> Veggie
                                </span>
                              )}
                              {dish.isGlutenFree && (
                                <span className="flex items-center gap-1 text-amber-500">
                                  <WheatOff className="w-3 h-3" /> Sin TACC
                                </span>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => handleAddToCart(dish.name)}
                              className="px-3 py-1 text-xs font-medium rounded text-white transition-opacity hover:opacity-90"
                              style={{ backgroundColor: currentPalette.primary }}
                            >
                              + Agregar
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Search & Category Filter Navigation */}
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-3">
                  <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Buscar plato, ingrediente..."
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-neutral-300 dark:border-neutral-700 bg-transparent focus:outline-hidden"
                    />
                  </div>

                  <div className="flex items-center gap-1.5 overflow-x-auto w-full pb-1">
                    <button
                      type="button"
                      onClick={() => setSelectedCatId('all')}
                      className={`px-3 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                        selectedCatId === 'all'
                          ? 'bg-neutral-800 text-white font-medium'
                          : 'text-neutral-500 hover:text-neutral-300'
                      }`}
                    >
                      Todo
                    </button>
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setSelectedCatId(cat.id)}
                        className={`px-3 py-1 text-xs rounded-md whitespace-nowrap transition-colors ${
                          selectedCatId === cat.id
                            ? 'bg-neutral-800 text-white font-medium'
                            : 'text-neutral-500 hover:text-neutral-300'
                        }`}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Product List */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                  {filteredProducts.map((prod) => (
                    <div
                      key={prod.id}
                      className="p-3.5 rounded-xl border flex gap-3 transition-colors"
                      style={{
                        backgroundColor: isDark
                          ? currentPalette.surfaceDark
                          : currentPalette.surfaceLight,
                        borderColor: isDark
                          ? 'rgba(255,255,255,0.08)'
                          : 'rgba(0,0,0,0.08)',
                      }}
                    >
                      {prod.imageUrl && (
                        <img
                          src={prod.imageUrl}
                          alt={prod.name}
                          referrerPolicy="no-referrer"
                          className="w-20 h-20 rounded-lg object-cover bg-neutral-800 shrink-0"
                        />
                      )}
                      <div className="flex-1 flex flex-col justify-between min-w-0">
                        <div>
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="font-semibold text-xs leading-tight line-clamp-1">
                              {prod.name}
                            </h4>
                            <span className="font-mono text-xs font-semibold tabular-nums whitespace-nowrap">
                              ${prod.price.toLocaleString('es-AR')}
                            </span>
                          </div>
                          <p className="text-[11px] text-neutral-400 mt-1 line-clamp-2">
                            {prod.description}
                          </p>
                        </div>

                        <div className="flex items-center justify-between mt-2 pt-2 border-t border-neutral-500/10">
                          <div className="flex items-center gap-2 text-[10px]">
                            {prod.isSpicy && (
                              <span className="flex items-center gap-0.5 text-red-500 font-medium">
                                <Flame className="w-2.5 h-2.5" /> Picante
                              </span>
                            )}
                            {prod.isGlutenFree && (
                              <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                                <WheatOff className="w-2.5 h-2.5" /> Sin TACC
                              </span>
                            )}
                            {prod.isVegetarian && (
                              <span className="flex items-center gap-0.5 text-emerald-500 font-medium">
                                <Leaf className="w-2.5 h-2.5" /> Veggie
                              </span>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => handleAddToCart(prod.name)}
                            className="p-1 px-2 text-[11px] font-medium rounded text-neutral-200 bg-neutral-800 hover:bg-neutral-700 transition-colors"
                          >
                            + Agregar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
