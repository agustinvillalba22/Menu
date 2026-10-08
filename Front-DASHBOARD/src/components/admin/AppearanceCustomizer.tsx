import React, { useState } from 'react';
import {
  AppearanceSettings,
  PalettePreset,
  FontFamilyChoice,
  ThemeMode,
  Product,
  Category
} from '../../types';
import {
  Sun,
  Moon,
  Check,
  X,
  Search,
  MapPin,
  Instagram,
  Star,
  FileText,
  Flame,
  WheatOff,
  Leaf,
  Plus,
  Sparkles,
  Sliders,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface AppearanceCustomizerProps {
  appearance: AppearanceSettings;
  palettes: PalettePreset[];
  products: Product[];
  categories: Category[];
  restaurantName: string;
  onSave: (settings: AppearanceSettings) => void;
}

export const AppearanceCustomizer: React.FC<AppearanceCustomizerProps> = ({
  appearance,
  palettes,
  products,
  categories,
  restaurantName,
  onSave,
}) => {
  const [liveSettings, setLiveSettings] = useState<AppearanceSettings>(appearance);
  const [saveSuccess, setSavedSuccess] = useState(false);
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);

  // Content customization (defaulting to the exact text from the screenshot)
  const [headlineText, setHeadlineText] = useState(liveSettings.heroHeadline || 'LA PIZZERIA');
  const [categoryTitle, setCategoryTitle] = useState('Comidas');
  const [productTitle, setProductTitle] = useState('Título Producto');
  const [productPrice, setProductPrice] = useState('31000');
  const [showAdvancedText, setShowAdvancedText] = useState(false);

  const selectedPalette =
    palettes.find((p) => p.id === liveSettings.paletteId) || palettes[0];
  const isDark = liveSettings.themeMode === 'dark';

  const handleSelectPalette = (paletteId: string) => {
    const updated = { ...liveSettings, paletteId };
    setLiveSettings(updated);
    onSave(updated);
  };

  const handleSelectFont = (fontFamily: FontFamilyChoice) => {
    const updated = { ...liveSettings, fontFamily };
    setLiveSettings(updated);
    onSave(updated);
  };

  const handleSelectMode = (themeMode: ThemeMode) => {
    const updated = { ...liveSettings, themeMode };
    setLiveSettings(updated);
    onSave(updated);
  };

  const handleManualSave = () => {
    const updated = { ...liveSettings, heroHeadline: headlineText };
    onSave(updated);
    setSavedSuccess(true);
    setTimeout(() => setSavedSuccess(false), 2200);
  };

  // 5 Headings Typography options from the screenshot
  const typographyChoices: Array<{
    id: FontFamilyChoice;
    name: string;
    icon: string;
    cssClass: string;
    description: string;
  }> = [
    {
      id: 'satoshi',
      name: 'Satoshi Moderno',
      icon: '✨',
      cssClass: 'font-satoshi',
      description: 'Grotesk sans-serif contemporánea y limpia',
    },
    {
      id: 'bebas',
      name: 'BEBAS IMPACTANTE',
      icon: '💥',
      cssClass: 'font-bebas tracking-wide',
      description: 'Titulares enérgicos y condensados de alta presencia',
    },
    {
      id: 'playfair',
      name: 'Playfair Elegante',
      icon: '📜',
      cssClass: 'font-playfair',
      description: 'Serif editorial clásico de alta gama',
    },
    {
      id: 'lilita',
      name: 'Lilita Divertido',
      icon: '🎨',
      cssClass: 'font-lilita',
      description: 'Display redondeado, cercano y amistoso',
    },
    {
      id: 'montserrat',
      name: 'Montserrat Urbano',
      icon: '💫',
      cssClass: 'font-montserrat',
      description: 'Geométrico moderno de gran legibilidad',
    },
  ];

  // 5 Theme Colors from the screenshot
  const themeColors: Array<{
    id: string;
    name: string;
    dotColor1: string;
    dotColor2: string;
    gradientClass: string;
    primaryHex: string;
  }> = [
    {
      id: 'rojo-vivo',
      name: 'Rojo Vivo',
      dotColor1: '#DC2626',
      dotColor2: '#EF4444',
      gradientClass: 'from-red-600 via-red-600 to-red-800',
      primaryHex: '#DC2626',
    },
    {
      id: 'azul-electrico',
      name: 'Azul Eléctrico',
      dotColor1: '#2563EB',
      dotColor2: '#3B82F6',
      gradientClass: 'from-blue-600 via-blue-600 to-blue-900',
      primaryHex: '#2563EB',
    },
    {
      id: 'violeta-neon',
      name: 'Violeta Neón',
      dotColor1: '#9333EA',
      dotColor2: '#A855F7',
      gradientClass: 'from-purple-600 via-purple-600 to-purple-900',
      primaryHex: '#9333EA',
    },
    {
      id: 'amarillo-citrico',
      name: 'Amarillo Cítrico',
      dotColor1: '#D97706',
      dotColor2: '#EAB308',
      gradientClass: 'from-amber-500 via-amber-600 to-amber-800',
      primaryHex: '#D97706',
    },
    {
      id: 'azul-profundo',
      name: 'Azul Profundo',
      dotColor1: '#0F172A',
      dotColor2: '#38BDF8',
      gradientClass: 'from-slate-800 via-slate-900 to-slate-950',
      primaryHex: '#0F172A',
    },
  ];

  const currentTheme =
    themeColors.find((t) => t.id === liveSettings.paletteId) || themeColors[0];

  const getFontFamilyClass = (f: FontFamilyChoice) => {
    switch (f) {
      case 'bebas':
        return 'font-bebas tracking-wide';
      case 'playfair':
        return 'font-playfair';
      case 'lilita':
        return 'font-lilita';
      case 'satoshi':
        return 'font-satoshi';
      case 'montserrat':
      default:
        return 'font-montserrat';
    }
  };

  // Savory gourmet pancake image matching the screenshot
  const dishImageUrl =
    'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80';

  return (
    <div className="h-full w-full flex bg-neutral-100/80 overflow-hidden">
      {/* 3-Column Layout: Center Phone Model, Right Editing Customization Panel */}
      <div className="flex-1 h-full flex overflow-hidden">
        {/* CENTER COLUMN: El menú modelo ocupando el alto completo */}
        <div className="flex-1 h-full overflow-hidden flex flex-col items-center justify-center p-2 md:p-4">
          {/* Smartphone Mockup Frame - Alto completo */}
          <div
            className={`w-full max-w-[390px] h-full max-h-[calc(100vh-1rem)] rounded-[38px] shadow-2xl border-4 transition-all duration-300 overflow-hidden flex flex-col ${
              isDark
                ? 'bg-[#191B1D] border-neutral-800 text-neutral-100 shadow-black/40'
                : 'bg-[#F3F4F6] border-white text-neutral-900 shadow-neutral-300/80'
            }`}
          >
            {/* Phone Top Speaker & Camera Notch */}
            <div className="pt-2 px-6 flex items-center justify-between bg-black/5 shrink-0">
              <span className="text-[10px] font-mono opacity-60">9:41</span>
              <div className="w-16 h-3 bg-black/30 rounded-full" />
              <div className="flex items-center gap-1 opacity-60 text-[10px]">
                <span>5G</span>
                <span>100%</span>
              </div>
            </div>

            {/* Gradient Header Banner */}
            <div
              className={`p-4 pt-3 pb-4 bg-gradient-to-b ${currentTheme.gradientClass} text-white transition-colors duration-300 rounded-b-3xl shadow-sm shrink-0`}
            >
              {/* Top Icons Row */}
              <div className="flex items-center justify-between mb-3">
                {/* Logo circle */}
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shadow-md p-1">
                  <div
                    className="w-full h-full rounded-full flex items-center justify-center font-bold text-white text-xs shadow-xs"
                    style={{ backgroundColor: currentTheme.primaryHex }}
                  >
                    {headlineText.charAt(0) || 'P'}
                  </div>
                </div>

                {/* Social & action icons */}
                <div className="flex items-center gap-2.5 text-white/90">
                  <button type="button" className="p-1 hover:text-white transition-colors">
                    <MapPin className="w-4 h-4" />
                  </button>
                  <button type="button" className="p-1 hover:text-white transition-colors">
                    <Instagram className="w-4 h-4" />
                  </button>
                  <button type="button" className="p-1 hover:text-white transition-colors">
                    <Star className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-white/20 hover:bg-white/30 text-[10px] font-bold tracking-wider"
                  >
                    <FileText className="w-3 h-3" />
                    <span>ES</span>
                  </button>
                </div>
              </div>

              {/* Restaurant Name in Headings Typography */}
              <h1
                className={`text-2xl font-bold tracking-tight text-white uppercase drop-shadow-xs mb-3 ${getFontFamilyClass(
                  liveSettings.fontFamily
                )}`}
              >
                {headlineText}
              </h1>

              {/* Search Pill Input */}
              <div className="w-full px-3.5 py-2 rounded-full bg-black/25 backdrop-blur-xs border border-white/20 flex items-center justify-between text-xs text-white">
                <span className="text-white/80 text-[11px]">Buscar producto</span>
                <Search className="w-3.5 h-3.5 text-white/80" />
              </div>
            </div>

            {/* Scrollable Dish List Container - Fills full phone height */}
            <div className="flex-1 p-4 space-y-3.5 overflow-y-auto">
              {/* Category Title */}
              <h2
                className={`text-base font-bold tracking-wide mt-1 mb-2 ${getFontFamilyClass(
                  liveSettings.fontFamily
                )} ${isDark ? 'text-neutral-200' : 'text-neutral-800'}`}
              >
                {categoryTitle}
              </h2>

              {/* Dish Cards (4 identical default cards as in the screenshot) */}
              {[1, 2, 3, 4].map((idx) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-2xl transition-all duration-200 flex items-center justify-between gap-3 ${
                    isDark
                      ? 'bg-[#2B2D30] border border-neutral-700/40 text-neutral-100 shadow-xs'
                      : 'bg-white border border-neutral-200/70 text-neutral-900 shadow-xs'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-1">
                      <h3
                        className={`text-xs font-bold truncate leading-tight ${getFontFamilyClass(
                          liveSettings.fontFamily
                        )}`}
                      >
                        {productTitle}
                      </h3>
                      <span
                        className="font-mono text-xs font-bold tabular-nums ml-2 shrink-0"
                        style={{
                          color: isDark ? '#FFFFFF' : currentTheme.primaryHex,
                        }}
                      >
                        ${Number(productPrice).toLocaleString('es-AR')}
                      </span>
                    </div>

                    <p
                      className={`text-[10px] line-clamp-2 mt-1 leading-snug ${
                        isDark ? 'text-neutral-400' : 'text-neutral-500'
                      }`}
                    >
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit...
                    </p>

                    {/* Dietary badge circles: Red chili, Yellow wheat, Green leaf */}
                    <div className="flex items-center gap-1.5 mt-2.5">
                      <span
                        className="w-4 h-4 rounded-full bg-red-600 text-white flex items-center justify-center shadow-xs"
                        title="Picante"
                      >
                        <Flame className="w-2.5 h-2.5" />
                      </span>
                      <span
                        className="w-4 h-4 rounded-full bg-amber-500 text-white flex items-center justify-center shadow-xs"
                        title="Sin TACC"
                      >
                        <WheatOff className="w-2.5 h-2.5" />
                      </span>
                      <span
                        className="w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow-xs"
                        title="Veggie"
                      >
                        <Leaf className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>

                  {/* Thumbnail Dish Photo with Plus button */}
                  <div className="relative shrink-0 w-20 h-20 rounded-xl overflow-hidden shadow-xs bg-neutral-200">
                    <img
                      src={dishImageUrl}
                      alt="Plato"
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      className="absolute bottom-1 right-1 w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center"
                      style={{ color: currentTheme.primaryHex }}
                      title="Agregar"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Large Featured Dish Card (Item 5 from screenshot) */}
              <div className="relative h-48 rounded-2xl overflow-hidden shadow-md group mt-3">
                <img
                  src={dishImageUrl}
                  alt="Plato Destacado"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                />

                {/* Top-right Plus Button */}
                <button
                  type="button"
                  className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center"
                  style={{ color: currentTheme.primaryHex }}
                >
                  <Plus className="w-4 h-4 stroke-[2.5]" />
                </button>

                {/* Bottom Dark Gradient Overlay */}
                <div className="absolute inset-x-0 bottom-0 p-3.5 pt-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex items-end justify-between">
                  <div className="text-white min-w-0 pr-2">
                    <h3
                      className={`text-sm font-bold truncate leading-tight drop-shadow-xs ${getFontFamilyClass(
                        liveSettings.fontFamily
                      )}`}
                    >
                      {productTitle}
                    </h3>
                    <p className="text-[10px] text-white/80 line-clamp-1 mt-0.5 drop-shadow-xs">
                      Lorem ipsum dolor sit amet, consectetur adipiscing elit...
                    </p>
                  </div>

                  <span className="font-mono text-sm font-bold text-amber-300 shrink-0 drop-shadow-xs">
                    ${Number(productPrice).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Menú de Edición del Menú ("PERSONALIZACIÓN") */}
        <div
          className={`w-80 md:w-96 h-full bg-white border-l border-neutral-200 flex flex-col justify-between overflow-hidden shadow-lg transition-all duration-300 shrink-0 ${
            isPanelCollapsed ? 'w-12 overflow-hidden' : ''
          }`}
        >
          {isPanelCollapsed ? (
            <div className="p-3 flex flex-col items-center">
              <button
                type="button"
                onClick={() => setIsPanelCollapsed(false)}
                className="p-2 text-neutral-500 hover:text-neutral-900 rounded-lg hover:bg-neutral-100"
                title="Expandir panel de personalización"
              >
                <Sliders className="w-5 h-5 text-amber-600" />
              </button>
            </div>
          ) : (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Panel Header */}
              <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-base">🎨</span>
                  <h2 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">
                    PERSONALIZACIÓN
                  </h2>
                </div>

                <div className="flex items-center gap-1">
                  {saveSuccess && (
                    <span className="text-[11px] text-emerald-600 font-semibold mr-1 flex items-center gap-1">
                      <Check className="w-3 h-3" /> ¡Listo!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsPanelCollapsed(true)}
                    className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                    title="Colapsar panel"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Scrollable Control Sections */}
              <div className="flex-1 overflow-y-auto p-5 space-y-6">
                {/* SECTION 1: MODO DE PANTALLA */}
                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide">
                      MODO DE PANTALLA:
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        liveSettings.themeMode === 'light'
                          ? 'text-red-500'
                          : 'text-neutral-900'
                      }`}
                    >
                      {liveSettings.themeMode === 'light' ? 'Claro' : 'Oscuro'}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 p-1 bg-neutral-100 rounded-xl border border-neutral-200/80">
                    <button
                      type="button"
                      onClick={() => handleSelectMode('light')}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                        liveSettings.themeMode === 'light'
                          ? 'bg-white text-neutral-900 shadow-sm font-semibold'
                          : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      <Sun className="w-4 h-4 text-amber-500" />
                      <span>Claro</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSelectMode('dark')}
                      className={`flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all ${
                        liveSettings.themeMode === 'dark'
                          ? 'bg-neutral-900 text-white shadow-sm font-semibold'
                          : 'text-neutral-500 hover:text-neutral-800'
                      }`}
                    >
                      <Moon className="w-4 h-4 text-amber-400" />
                      <span>Oscuro</span>
                    </button>
                  </div>
                </div>

                {/* SECTION 2: THEME COLOR */}
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide block">
                    THEME COLOR:
                  </span>

                  <div className="space-y-1.5">
                    {themeColors.map((theme) => {
                      const isSelected = liveSettings.paletteId === theme.id;
                      return (
                        <button
                          key={theme.id}
                          type="button"
                          onClick={() => handleSelectPalette(theme.id)}
                          className={`w-full px-3 py-2.5 rounded-xl border flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-red-50/80 border-red-200 text-neutral-900 shadow-2xs'
                              : 'bg-white border-transparent hover:bg-neutral-50 text-neutral-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            {/* Dual dot / gradient preview circle */}
                            <div className="flex items-center -space-x-1">
                              <span
                                className="w-4 h-4 rounded-full border border-black/10 shadow-xs"
                                style={{ backgroundColor: theme.dotColor1 }}
                              />
                              <span
                                className="w-4 h-4 rounded-full border border-black/10 shadow-xs"
                                style={{ backgroundColor: theme.dotColor2 }}
                              />
                            </div>
                            <span className="text-xs font-semibold">
                              {theme.name}
                            </span>
                          </div>

                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-xs">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SECTION 3: HEADINGS TYPOGRAPHY */}
                <div className="space-y-2.5">
                  <span className="text-xs font-bold text-neutral-700 uppercase tracking-wide block">
                    HEADINGS TYPOGRAPHY:
                  </span>

                  <div className="space-y-1.5">
                    {typographyChoices.map((font) => {
                      const isSelected = liveSettings.fontFamily === font.id;
                      return (
                        <button
                          key={font.id}
                          type="button"
                          onClick={() => handleSelectFont(font.id)}
                          className={`w-full px-3 py-2.5 rounded-xl border flex items-center justify-between transition-all ${
                            isSelected
                              ? 'bg-red-50/80 border-red-200 text-neutral-900 shadow-2xs'
                              : 'bg-white border-transparent hover:bg-neutral-50 text-neutral-700'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-sm shrink-0">{font.icon}</span>
                            <div className="text-left min-w-0">
                              <span
                                className={`text-xs block leading-tight ${font.cssClass} ${
                                  isSelected
                                    ? 'text-red-700 font-bold'
                                    : 'font-semibold text-neutral-800'
                                }`}
                              >
                                {font.name}
                              </span>
                              <span className="text-[10px] text-neutral-400 block line-clamp-1">
                                {font.description}
                              </span>
                            </div>
                          </div>

                          {isSelected && (
                            <span className="w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center shadow-xs shrink-0 ml-2">
                              <Check className="w-3 h-3 stroke-[3]" />
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* SECTION 4: TEXT CONTENT CUSTOMIZATION (ACCORDION) */}
                <div className="pt-2 border-t border-neutral-100">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedText(!showAdvancedText)}
                    className="w-full flex items-center justify-between text-xs font-semibold text-neutral-700 py-1"
                  >
                    <span>Editar Textos del Modelo</span>
                    {showAdvancedText ? (
                      <ChevronUp className="w-4 h-4 text-neutral-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-neutral-400" />
                    )}
                  </button>

                  {showAdvancedText && (
                    <div className="mt-3 space-y-3 p-3 bg-neutral-50 rounded-xl border border-neutral-200/70 text-xs">
                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                          Título del Local (Cabecera)
                        </label>
                        <input
                          type="text"
                          value={headlineText}
                          onChange={(e) => setHeadlineText(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs rounded-lg border border-neutral-300 bg-white"
                        />
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                          Nombre de Categoría
                        </label>
                        <input
                          type="text"
                          value={categoryTitle}
                          onChange={(e) => setCategoryTitle(e.target.value)}
                          className="w-full px-2.5 py-1 text-xs rounded-lg border border-neutral-300 bg-white"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                            Título Producto
                          </label>
                          <input
                            type="text"
                            value={productTitle}
                            onChange={(e) => setProductTitle(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs rounded-lg border border-neutral-300 bg-white"
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] font-medium text-neutral-600 mb-1">
                            Precio ($)
                          </label>
                          <input
                            type="text"
                            value={productPrice}
                            onChange={(e) => setProductPrice(e.target.value)}
                            className="w-full px-2.5 py-1 text-xs rounded-lg border border-neutral-300 bg-white font-mono"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Panel Footer */}
              <div className="p-4 border-t border-neutral-100 bg-neutral-50/80 flex items-center justify-between shrink-0">
                <span className="text-[11px] text-neutral-500 font-mono">
                  Auto-guardado activo
                </span>
                <button
                  type="button"
                  onClick={handleManualSave}
                  className="px-4 py-2 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-xs"
                >
                  Guardar Diseño
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
