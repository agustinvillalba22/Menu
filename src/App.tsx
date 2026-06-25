/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { ShoppingBag, ChevronRight, Palette } from 'lucide-react';
import { Product, CartItem } from './types';
import { PRODUCTS } from './data';
import Header from './components/Header';
import MenuFilter from './components/MenuFilter';
import PromoBanner from './components/PromoBanner';
import ProductCard from './components/ProductCard';
import ProductDetailModal from './components/ProductDetailModal';
import CartDrawer from './components/CartDrawer';
import WhatsAppCheckoutModal from './components/WhatsAppCheckoutModal';

const themesConfig = {
  'rojo': { name: '🔴 Rojo Vivo', primario: '#FC462F', secundario: '#FFE0E0' },
  'azul': { name: '🔵 Azul Eléctrico', primario: '#0057FF', secundario: '#DCE8FF' },
  'violeta': { name: '🟣 Violeta Neón', primario: '#DC1EFC', secundario: '#FFE0EC' },
  'amarillo': { name: '🟡 Amarillo Cítrico', primario: '#F4B400', secundario: '#FFF3CC' },
  'azul-oscuro': { name: '⚵ Azul Profundo', primario: '#1F4E5F', secundario: '#D7E4E8' },
  'terracota': { name: '🧱 Terracota Rústico', primario: '#B85C38', secundario: '#E6D2C3' },
  'negro': { name: '⚫ Mineral Oscuro', primario: '#1A1A1A', secundario: '#E9E7C7' },
  'verde-oliva': { name: '🌿 Verde Campestre', primario: '#556B2F', secundario: '#DCE4C2' },
};

const fontsConfig = {
  'satoshi': { name: '✨ Satoshi Moderno', value: '"Satoshi", sans-serif' },
  'bebas': { name: '💥 Bebas Impactante', value: '"Bebas Neue", sans-serif' },
  'playfair': { name: '📜 Playfair Elegante', value: '"Playfair Display", serif' },
  'lilita': { name: '🍭 Lilita Divertido', value: '"Lilita One", sans-serif' },
  'grotesk': { name: '🚀 Space Grotesk', value: '"Space Grotesk", sans-serif' },
  'cinzel': { name: '🏛️ Cinzel Clásico', value: '"Cinzel", serif' },
};

export default function App() {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  
  const [currentThemeKey, setCurrentThemeKey] = useState<keyof typeof themesConfig>(() => {
    try {
      const saved = localStorage.getItem('boulette_theme');
      if (saved && saved in themesConfig) return saved as keyof typeof themesConfig;
    } catch {}
    return 'rojo';
  });

  const [currentFontKey, setCurrentFontKey] = useState<keyof typeof fontsConfig>(() => {
    try {
      const saved = localStorage.getItem('boulette_font');
      if (saved && saved in fontsConfig) return saved as keyof typeof fontsConfig;
    } catch {}
    return 'satoshi';
  });

  const [showThemeMenu, setShowThemeMenu] = useState(false);

  // Load cart from LocalStorage on mount
  useEffect(() => {
    try {
      const persisted = localStorage.getItem('boulette_digital_cart');
      if (persisted) {
        setCart(JSON.parse(persisted));
      }
    } catch {
      // Ignored
    }
  }, []);

  // Sync selected theme properties instantly to the document class and LocalStorage
  useEffect(() => {
    const theme = themesConfig[currentThemeKey];
    document.documentElement.style.setProperty('--color-primario', theme.primario);
    document.documentElement.style.setProperty('--color-secundario', theme.secundario);
    
    // Toggle theme-amarillo class for high contrast typography overrides on yellow backgrounds
    if (currentThemeKey === 'amarillo') {
      document.documentElement.classList.add('theme-amarillo');
    } else {
      document.documentElement.classList.remove('theme-amarillo');
    }

    try {
      localStorage.setItem('boulette_theme', currentThemeKey);
    } catch {}
  }, [currentThemeKey]);

  // Sync selected font properties instantly to the document class and LocalStorage
  useEffect(() => {
    const font = fontsConfig[currentFontKey];
    document.documentElement.style.setProperty('--font-heading', font.value);
    try {
      localStorage.setItem('boulette_font', currentFontKey);
    } catch {}
  }, [currentFontKey]);

  // Save cart to LocalStorage on change
  const saveCart = (newCart: CartItem[]) => {
    setCart(newCart);
    try {
      localStorage.setItem('boulette_digital_cart', JSON.stringify(newCart));
    } catch {
      // Ignored
    }
  };

  // Cart Management Actions
  const handleAddToCart = (newItem: CartItem) => {
    const existingIdx = cart.findIndex((item) => item.id === newItem.id);
    if (existingIdx > -1) {
      const updated = [...cart];
      updated[existingIdx].quantity += newItem.quantity;
      if (newItem.specialInstructions) {
        updated[existingIdx].specialInstructions = 
          (updated[existingIdx].specialInstructions ? updated[existingIdx].specialInstructions + ' | ' : '') + 
          newItem.specialInstructions;
      }
      saveCart(updated);
    } else {
      saveCart([...cart, newItem]);
    }
  };

  const handleUpdateQuantity = (itemId: string, change: number) => {
    const updated = cart.map((item) => {
      if (item.id === itemId) {
        const nextQuantity = item.quantity + change;
        return nextQuantity > 0 ? { ...item, quantity: nextQuantity } : null;
      }
      return item;
    }).filter(Boolean) as CartItem[];
    saveCart(updated);
  };

  const handleRemoveItem = (itemId: string) => {
    saveCart(cart.filter((item) => item.id !== itemId));
  };

  const handleClearCart = () => {
    saveCart([]);
  };

  // Dynamic filter products listed based on Category and Search queries
  const filteredProducts = PRODUCTS.filter((item) => {
    const matchesCategory = selectedCategory === 'all' || item.category === selectedCategory;
    
    // Normalize and search text matches
    const normSearch = searchQuery.toLowerCase().trim();
    if (!normSearch) return matchesCategory;

    const matchesName = item.name.toLowerCase().includes(normSearch);
    const matchesDesc = item.description.toLowerCase().includes(normSearch);
    const matchesSub = item.subcategory?.toLowerCase().includes(normSearch) || false;
    const matchesIng = item.ingredients.some((ing) => ing.name.toLowerCase().includes(normSearch));

    return matchesCategory && (matchesName || matchesDesc || matchesSub || matchesIng);
  });

  // Calculate generic aggregated sums
  const totalCartCount = cart.reduce((sum, item) => sum + item.quantity, 0);
  const totalCartPrice = cart.reduce((sum, item) => {
    const base = item.product.price;
    const extras = item.selectedModifiers
      .filter((m) => m.type === 'extra')
      .reduce((s, m) => s + m.price, 0);
    return sum + (base + extras) * item.quantity;
  }, 0);

  // Group displayed filtered items by their subcategories to create gorgeous sections
  const subcategoryGroups = filteredProducts.reduce((acc, product) => {
    const sub = product.subcategory || 'Otros';
    if (!acc[sub]) acc[sub] = [];
    acc[sub].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  // Identify the middle product only for categories in the filtered set with more than 5 products
  const middleProductIds = new Set<string>();
  const activeCategories = Array.from(new Set(filteredProducts.map((p) => p.category)));
  activeCategories.forEach((catId) => {
    const catProds = filteredProducts.filter((p) => p.category === catId);
    if (catProds.length >= 5) {
      const midIdx = Math.floor(catProds.length / 2);
      middleProductIds.add(catProds[midIdx].id);
    }
  });

  return (
    <div className="min-h-screen bg-[#f5f5f0] text-[#1a1a1a] selection:bg-primario/15">
      {/* Dynamic Theme Floating Button (Classy palette customization for demonstration) */}
      <div className="fixed bottom-24 right-5 z-40">
        <button
          onClick={() => setShowThemeMenu(!showThemeMenu)}
          className="w-12 h-12 rounded-full bg-white text-slate-800 shadow-xl border border-gray-150 flex items-center justify-center cursor-pointer hover:scale-105 transition-transform"
          title="Cambiar Tema del Local"
        >
          <Palette className="w-5 h-5 text-primario animate-pulse" />
        </button>

        {showThemeMenu && (
          <div className="absolute bottom-14 right-0 bg-white border border-gray-200 rounded-3xl p-4 shadow-2xl w-52 space-y-3.5 animate-fadeIn max-h-[460px] overflow-y-auto no-scrollbar">
            {/* Color section */}
            <div className="space-y-1.5">
              <h4 className="text-[9px] uppercase font-black text-gray-400 px-2 tracking-widest">
                Seleccionar Tema:
              </h4>
              <div className="max-h-36 overflow-y-auto no-scrollbar space-y-0.5 pr-0.5">
                {Object.entries(themesConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setCurrentThemeKey(key as keyof typeof themesConfig);
                    }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs font-bold font-sans transition-all flex items-center justify-between cursor-pointer ${
                      currentThemeKey === key
                        ? 'bg-secundario text-primario font-extrabold'
                        : 'hover:bg-gray-100 text-gray-700'
                    }`}
                  >
                    <span>{config.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="h-[1px] bg-gray-100 mx-1"></div>

            {/* Typography section */}
            <div className="space-y-1.5">
              <h4 className="text-[9px] uppercase font-black text-gray-400 px-2 tracking-widest">
                Tipografía Títulos:
              </h4>
              <div className="max-h-36 overflow-y-auto no-scrollbar space-y-0.5 pr-0.5">
                {Object.entries(fontsConfig).map(([key, config]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setCurrentFontKey(key as keyof typeof fontsConfig);
                    }}
                    style={{ fontFamily: config.value }}
                    className={`w-full text-left px-2.5 py-1.5 rounded-xl text-xs transition-all flex items-center justify-between cursor-pointer ${
                      currentFontKey === key
                        ? 'bg-secundario text-primario font-extrabold'
                        : 'hover:bg-gray-100 text-gray-700 font-medium'
                    }`}
                  >
                    <span>{config.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Visual background wrapper strictly constrained for supreme mobile representation on any browser view */}
      <div className="w-full max-w-md mx-auto bg-white min-h-screen shadow-2xl flex flex-col relative border-x border-gray-200 pb-20">
        
        {/* Dynamic header */}
        <Header 
          searchQuery={searchQuery} 
          setSearchQuery={setSearchQuery} 
          onOpenCart={() => setIsCartOpen(true)}
          cartCount={totalCartCount}
        />

        {/* Dynamic Category Filtering controls */}
        <MenuFilter selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} />

        {/* Dynamic Promotional Banner featuring tertiary color and scrolling shiny effect */}
        <PromoBanner 
          onClick={() => {
            const promoProduct = PRODUCTS.find((p) => p.id === 'burger-cheddar-especial');
            if (promoProduct) {
              const originalPrice = promoProduct.price;
              const discountedPrice = Math.round(originalPrice * 0.80);
              setSelectedProduct({
                ...promoProduct,
                price: discountedPrice,
                originalPrice: originalPrice,
                isPromo: true
              });
            }
          }}
        />

        {/* Dynamic Listing Layout */}
        <main className="flex-1 px-4 py-4 space-y-8">
          {filteredProducts.length === 0 ? (
            <div className="py-12 text-center flex flex-col items-center">
              <span className="text-4xl mb-3">🔍</span>
              <h3 className="font-sans text-lg font-black text-gray-850 uppercase">No encontramos resultados</h3>
              <p className="text-gray-400 text-xs mt-1.5 max-w-xs leading-relaxed">
                Prueba buscando otros ingredientes o cambia la categoría para tentar tu paladar.
              </p>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                }}
                className="mt-4 text-xs font-black text-primario hover:underline uppercase tracking-wide cursor-pointer"
              >
                Restablecer Filtros
              </button>
            </div>
          ) : (
            // Render products grouped cleanly by subcategory under headings
            Object.entries(subcategoryGroups).map(([groupTitle, products]) => (
              <div key={groupTitle} className="space-y-4">
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-5 bg-primario rounded-full"></div>
                  <h2 className="font-headings text-sm font-black text-gray-900 tracking-tight uppercase">
                    {groupTitle}
                  </h2>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {products.map((prod) => {
                    const isLarge = middleProductIds.has(prod.id);
                    return (
                      <ProductCard
                        key={prod.id}
                        product={prod}
                        onSelect={(p) => setSelectedProduct(p)}
                        isLarge={isLarge}
                      />
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </main>

        {/* Classic Footer inside the page margins */}
        <footer className="py-8 px-4 border-t border-dashed border-gray-150 text-center space-y-2 bg-gray-50/50">
          <div className="flex justify-center items-center gap-1.5 text-gray-300 font-extrabold text-lg select-none">
            <span>🍕</span>
            <span className="text-xs uppercase tracking-widest text-[#1a1a1a] font-black font-mono">LA PIZZERIA</span>
            <span>🍕</span>
          </div>
          <p className="text-[10px] text-gray-400 font-mono leading-none">
            Hecho en Montevideo, Uruguay con ingredientes auténticos.
          </p>
          <div className="w-full bg-primario h-1 rounded-full mt-3.5 opacity-10"></div>
        </footer>

        {/* Global Floating cart indicator for Mobile */}
        {totalCartCount > 0 && (
          <div className="fixed bottom-5 left-1/2 -translate-x-1/2 w-full max-w-xs z-30 px-3">
            <button
              id="btn-floating-cart"
              onClick={() => setIsCartOpen(true)}
              className="w-full bg-primario text-white py-4 px-6 rounded-2xl shadow-xl flex items-center justify-between transition-all duration-300 transform border border-transparent cursor-pointer hover:opacity-95 active:scale-[0.98]"
            >
              <div className="flex items-center gap-2.5">
                <div className="relative">
                  <ShoppingBag className="w-5 h-5 text-white" />
                  <span className="absolute -top-2.5 -right-2.5 bg-white text-primario w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-extrabold border border-primario">
                    {totalCartCount}
                  </span>
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold leading-none block">Ver Carrito</span>
                  <span className="text-[9px] uppercase font-mono text-white/80 leading-none">Mi pedido</span>
                </div>
              </div>

              <div className="flex items-center gap-1 text-sm font-bold font-mono">
                <span>${totalCartPrice}</span>
                <ChevronRight className="w-4 h-4 shrink-0" />
              </div>
            </button>
          </div>
        )}

        {/* Product Modifiers & Extra customization overlay */}
        <ProductDetailModal
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
          onAddToCart={handleAddToCart}
        />

        {/* Sliding interactive Cart Drawer list */}
        <CartDrawer
          isOpen={isCartOpen}
          onClose={() => setIsCartOpen(false)}
          cartItems={cart}
          onUpdateQuantity={handleUpdateQuantity}
          onRemoveItem={handleRemoveItem}
          onOpenCheckout={() => {
            setIsCartOpen(false);
            setIsCheckoutOpen(true);
          }}
        />

        {/* Form configuration and WhatsApp Checkout link trigger */}
        <WhatsAppCheckoutModal
          isOpen={isCheckoutOpen}
          onClose={() => setIsCheckoutOpen(false)}
          cartItems={cart}
          totalPrice={totalCartPrice}
          onClearCart={handleClearCart}
        />



      </div>
    </div>
  );
}
