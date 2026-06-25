/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Plus, Minus, ShoppingBag } from 'lucide-react';
import { Product, Modifier, CartItem } from '../types';

interface ProductDetailModalProps {
  product: Product | null;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
}

export default function ProductDetailModal({ product, onClose, onAddToCart }: ProductDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<Modifier[]>([]);
  const [specialInstructions, setSpecialInstructions] = useState('');

  // Reset internal states when product changes
  useEffect(() => {
    if (product) {
      setQuantity(1);
      setSelectedModifiers([]);
      setSpecialInstructions('');
    }
  }, [product]);

  if (!product) return null;

  // Toggle modifier selection
  const handleToggleModifier = (modifier: Modifier) => {
    const exists = selectedModifiers.some((m) => m.id === modifier.id);
    if (exists) {
      setSelectedModifiers(selectedModifiers.filter((m) => m.id !== modifier.id));
    } else {
      setSelectedModifiers([...selectedModifiers, modifier]);
    }
  };

  // Calculate dynamic price per unit (product base price + selected extras)
  const extrasPrice = selectedModifiers
    .filter((m) => m.type === 'extra')
    .reduce((sum, m) => sum + m.price, 0);
  
  const unitPrice = product.price + extrasPrice;
  const totalPrice = unitPrice * quantity;

  const handleAdd = () => {
    const cartItem: CartItem = {
      id: `${product.id}-${selectedModifiers.map((m) => m.id).sort().join('-')}${product.isPromo ? '-promo' : ''}`,
      product,
      quantity,
      selectedModifiers,
      specialInstructions: specialInstructions.trim() || undefined,
    };
    onAddToCart(cartItem);
    onClose();
  };

  // Pizzas are added exactly "as is", unless they are "marinara" or "potaxio-veggie"
  const isPizza = product.category === 'principales' && product.id.startsWith('pizza-');
  const showExtrasForPizza = product.id.includes('marinara') || product.id.includes('potaxio-veggie');

  const extrasList = (!isPizza || showExtrasForPizza)
    ? product.modifiers.filter((m) => m.type === 'extra')
    : [];

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 cursor-pointer"
        />

        {/* Modal Sheet Container */}
        <motion.div
          initial={{ y: '100%', opacity: 0.8 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0.8 }}
          transition={{ type: 'spring', damping: 25, stiffness: 210 }}
          className="relative bg-white w-full sm:max-w-md h-[92vh] sm:h-[85vh] rounded-t-3xl sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col z-10 border-t-4 border-primario"
        >
          {/* Header sticky bar over image */}
          <div className="absolute top-4 right-4 z-24">
            <button
              onClick={onClose}
              className="w-9 h-9 rounded-full bg-black/55 hover:bg-black/75 backdrop-blur-xs text-white flex items-center justify-center transition-all cursor-pointer shadow-md"
            >
              <X className="w-4.5 h-4.5" />
            </button>
          </div>

          {/* Scrollable Container */}
          <div className="flex-1 overflow-y-auto no-scrollbar">
            {/* Product Big Imagery */}
            <div className="relative aspect-video w-full bg-gray-100">
              <img
                src={product.image}
                alt={product.name}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>
              <div className="absolute bottom-4 left-4 right-16">
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span className="text-[10px] uppercase font-black tracking-widest text-primario bg-white px-2 py-0.5 rounded-full inline-block">
                    {product.subcategory || product.category}
                  </span>
                  {product.isPromo && (
                    <span className="text-[10px] uppercase font-black tracking-widest text-white bg-red-500 px-2.5 py-0.5 rounded-full inline-block animate-pulse font-sans">
                      ¡20% OFF HOY!
                    </span>
                  )}
                </div>
                <h2 className="font-sans text-2xl font-black text-white tracking-tight drop-shadow-md">
                  {product.name}
                </h2>
              </div>
            </div>

            {/* Modal Scrollable Contents */}
            <div className="p-5 space-y-6 pb-10">
              {/* Description */}
              <div className="space-y-1">
                <p className="text-gray-600 text-xs leading-relaxed">
                  {product.description}
                </p>
                <div className="flex items-center gap-2 pt-2">
                  <span className="font-sans text-xs font-bold text-gray-400 uppercase tracking-wider">Precio base:</span>
                  {product.originalPrice ? (
                    <div className="flex items-center gap-1.5">
                      <span className="font-sans text-xs font-bold text-gray-400 line-through">${product.originalPrice}</span>
                      <span className="font-sans text-base font-black text-primario">${product.price}</span>
                    </div>
                  ) : (
                    <span className="font-sans text-base font-black text-primario">${product.price}</span>
                  )}
                </div>
              </div>

              {/* Ingredients with custom word & icon wrapper */}
              <div className="space-y-3 bg-[#f5f5f0]/80 p-4 rounded-2xl border border-gray-150">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-primario flex items-center gap-1.5 font-sans">
                  <span>🍃</span> Ingredientes Principales
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {product.ingredients.map((ing, idx) => (
                    <div
                      key={idx}
                      className="flex items-center gap-2 bg-white/95 p-2 rounded-xl border border-gray-100 shadow-3xs"
                    >
                      <span className="text-base shrink-0">{ing.icon}</span>
                      <span className="text-xs text-gray-700 font-bold truncate font-sans">{ing.name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Extras Section */}
              {extrasList.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 font-sans">
                      Extras & Modificadores
                    </h4>
                    <span className="text-[9px] font-extrabold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full font-sans uppercase">Opcional</span>
                  </div>
                  <div className="space-y-2.5">
                    {extrasList.map((modifier) => {
                      const isSelected = selectedModifiers.some((m) => m.id === modifier.id);
                      return (
                        <button
                          key={modifier.id}
                          id={`modifier-${modifier.id}`}
                          onClick={() => handleToggleModifier(modifier)}
                          className={`w-full flex items-center justify-between p-4 rounded-2xl border transition-all duration-200 cursor-pointer ${
                            isSelected
                              ? 'border-2 border-primario bg-secundario text-primario'
                              : 'border border-gray-150 bg-white text-gray-800 hover:border-gray-350'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                              isSelected 
                                ? 'border-4 border-primario bg-white scale-110' 
                                : 'border border-gray-300 bg-white'
                            }`} />
                            <span className="text-sm font-bold font-sans">{modifier.name}</span>
                          </div>
                          <span className={`font-mono text-xs font-black leading-none ${isSelected ? 'text-primario' : 'text-gray-500'}`}>
                            +${modifier.price}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Special comments input */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-400 font-sans">
                  ✍️ Instrucciones Especiales
                </h4>
                <textarea
                  placeholder="Ej: Cocción a punto / Sin cebolla / Sin salsa..."
                  value={specialInstructions}
                  onChange={(e) => setSpecialInstructions(e.target.value)}
                  rows={2}
                  className="w-full px-4 py-3 text-xs bg-[#f5f5f0] border border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-primario focus:bg-white transition-all shadow-3xs"
                />
              </div>
            </div>
          </div>

          {/* Sticky action bottom panel */}
          <div className="p-4 bg-white border-t border-gray-150 flex flex-col gap-3 shadow-lg shrink-0 font-sans z-10 sticky bottom-0">
            <div className="flex items-center justify-between">
              {/* Product Quantities */}
              <div className="flex items-center bg-gray-150 rounded-xl p-0.5 border border-gray-200/80">
                <button
                  id="btn-decrement"
                  disabled={quantity <= 1}
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-primario hover:bg-white active:scale-90 disabled:opacity-40 transition-all cursor-pointer"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <span className="font-mono text-sm font-bold px-3.5 text-gray-800">{quantity}</span>
                <button
                  id="btn-increment"
                  onClick={() => setQuantity((q) => q + 1)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-primario hover:bg-white active:scale-90 transition-all cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              {/* Aggregated price calculations */}
              <div className="text-right">
                <span className="text-[9px] text-gray-400 uppercase tracking-widest block font-extrabold">Total aproximado</span>
                <span className="font-mono text-xl font-black text-primario">${totalPrice}</span>
              </div>
            </div>

            {/* Add button */}
            <button
              id="btn-add-to-cart"
              onClick={handleAdd}
              className="w-full bg-primario text-white py-4 rounded-2xl font-bold flex items-center justify-center gap-3 shadow-lg hover:opacity-95 active:scale-[0.98] transition-all text-base cursor-pointer"
            >
              <ShoppingBag className="w-4.5 h-4.5 text-white shrink-0" />
              <span>Añadir al Pedido</span>
              <span className="bg-white/20 px-2.5 py-0.5 rounded-full text-xs font-mono font-bold">${totalPrice}</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
