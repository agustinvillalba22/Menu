/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { AnimatePresence, motion } from 'motion/react';
import { X, Trash2, Plus, Minus, Send, ShoppingBag } from 'lucide-react';
import { CartItem } from '../types';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  onUpdateQuantity: (id: string, amount: number) => void;
  onRemoveItem: (id: string) => void;
  onOpenCheckout: () => void;
}

export default function CartDrawer({
  isOpen,
  onClose,
  cartItems,
  onUpdateQuantity,
  onRemoveItem,
  onOpenCheckout,
}: CartDrawerProps) {
  const itemTotal = (item: CartItem) => {
    const base = item.product.price;
    const extras = item.selectedModifiers
      .filter((m) => m.type === 'extra')
      .reduce((sum, m) => sum + m.price, 0);
    return (base + extras) * item.quantity;
  };

  const totalPrice = cartItems.reduce((sum, item) => sum + itemTotal(item), 0);
  const totalCount = cartItems.reduce((sum, item) => sum + item.quantity, 0);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-40 flex justify-end">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs cursor-pointer"
        />

        {/* Drawer Box Sheet */}
        <motion.div
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'spring', damping: 25, stiffness: 220 }}
          className="relative bg-[#f5f5f0] w-full max-w-md h-full shadow-2xl flex flex-col z-40 border-l border-gray-200"
        >
          {/* Drawer Header with sleek red banner */}
          <div className="relative">
            <div className="h-2 w-full bg-primario opacity-90 shadow-2xs"></div>
            <div className="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-secundario flex items-center justify-center text-primario">
                  <ShoppingBag className="w-4.5 h-4.5 text-primario" />
                </div>
                <div>
                  <h3 className="font-sans text-lg font-black text-gray-900 leading-none uppercase">Mi Pedido</h3>
                  <span className="text-[10px] uppercase font-mono tracking-wider text-gray-400">
                    {totalCount} {totalCount === 1 ? 'producto' : 'productos'} seleccionados
                  </span>
                </div>
              </div>

              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full bg-gray-150 hover:bg-gray-200 text-gray-500 hover:text-gray-900 flex items-center justify-center transition-all cursor-pointer"
              >
                <X className="w-4.5 h-4.5" />
              </button>
            </div>
          </div>

          {/* Cart Contents list */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {cartItems.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8">
                <span className="text-5xl mb-3 animate-pulse">🍔</span>
                <h4 className="font-sans text-lg font-black text-gray-850 uppercase">Tu carrito está vacío</h4>
                <p className="text-gray-400 text-xs mt-1.5 max-w-xs leading-relaxed">
                  ¿Y si te tentás con una deliciosa burger de doble carne smash o un lomo recién horneado?
                </p>
                <button
                  id="btn-close-empty"
                  onClick={onClose}
                  className="mt-5 bg-primario hover:opacity-90 text-white font-bold text-xs tracking-wider uppercase px-5 py-2.5 rounded-full shadow-md transition-all cursor-pointer"
                >
                  Ver Menú Digital
                </button>
              </div>
            ) : (
              cartItems.map((item) => {
                const extras = item.selectedModifiers.filter((m) => m.type === 'extra');
                
                return (
                  <div
                    key={item.id}
                    id={`cart-item-${item.id}`}
                    className="bg-white rounded-3xl border border-gray-150 p-4 shadow-3xs space-y-3.5 hover:border-gray-350 transition-colors"
                  >
                    {/* Item Info section */}
                    <div className="flex items-start gap-3">
                      <img
                        src={item.product.image}
                        alt={item.product.name}
                        referrerPolicy="no-referrer"
                        className="w-14 h-14 rounded-2xl object-cover border border-gray-100 shrink-0"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex justify-between items-start gap-1">
                          <h4 className="font-sans text-[15px] font-black text-gray-900 leading-tight truncate">
                            {item.product.name}
                          </h4>
                          <span className="font-sans text-sm font-black text-primario">
                            ${itemTotal(item)}
                          </span>
                        </div>
                        
                        <p className="text-[10px] text-gray-400 font-mono mt-0.5 uppercase tracking-wider font-semibold">
                          Precio unitario: ${item.product.price}
                        </p>
                      </div>
                    </div>

                    {/* Specified modifiers badges */}
                    {(extras.length > 0 || item.specialInstructions) && (
                      <div className="bg-[#f5f5f0]/80 rounded-2xl p-3 text-[11px] space-y-1.5 border border-gray-200">
                        {extras.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            <span className="text-gray-400 font-bold uppercase text-[9px] mr-1 inline-block self-center">Adiciones:</span>
                            {extras.map((ex) => (
                              <span
                                key={ex.id}
                                className="inline-flex bg-secundario text-primario border border-primario/10 px-1.5 py-0.5 rounded font-black"
                              >
                                {ex.name}
                              </span>
                            ))}
                          </div>
                        )}
                        {item.specialInstructions && (
                          <div className="text-gray-600 italic">
                            <span className="font-bold not-italic">✍️ Nota: </span>
                            "{item.specialInstructions}"
                          </div>
                        )}
                      </div>
                    )}

                    {/* Quantity operators and deletion */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-dashed border-gray-150">
                      <div className="flex items-center bg-gray-100 rounded-lg p-0.5 border border-gray-200/60 font-sans">
                        <button
                          id={`btn-cart-dec-${item.id}`}
                          onClick={() => onUpdateQuantity(item.id, -1)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-primario hover:bg-white transition-all cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono text-xs font-bold px-3 text-gray-700">{item.quantity}</span>
                        <button
                          id={`btn-cart-inc-${item.id}`}
                          onClick={() => onUpdateQuantity(item.id, 1)}
                          className="w-7 h-7 rounded-md flex items-center justify-center text-gray-400 hover:text-primario hover:bg-white transition-all cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      <button
                        id={`btn-cart-del-${item.id}`}
                        onClick={() => onRemoveItem(item.id)}
                        className="w-8 h-8 rounded-lg text-gray-400 hover:text-primario hover:bg-secundario flex items-center justify-center transition-all cursor-pointer"
                        title="Quitar producto"
                      >
                        <Trash2 className="w-4.5 h-4.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Sticky Total calculations & checkout trigger */}
          {cartItems.length > 0 && (
            <div className="p-4 bg-white border-t border-gray-205 space-y-3.5 shadow-lg">
              <div className="space-y-1.5 p-1">
                <div className="flex justify-between text-xs text-gray-400 font-medium font-sans">
                  <span>Subtotal del pedido</span>
                  <span className="font-mono font-bold">${totalPrice}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-400 font-medium font-sans">
                  <span>Costo de envío / servicio</span>
                  <span className="text-emerald-600 font-bold uppercase tracking-wide text-[11px]">A coordinar</span>
                </div>
                <div className="border-t border-dashed border-gray-200 my-1.5"></div>
                <div className="flex justify-between items-center text-sm font-sans">
                  <span className="font-extrabold text-gray-850">Total aproximado:</span>
                  <span className="font-mono text-2xl font-black text-primario">${totalPrice}</span>
                </div>
              </div>

              <button
                id="btn-cart-checkout"
                onClick={onOpenCheckout}
                className="w-full bg-primario text-white py-4 rounded-2xl font-bold text-base flex items-center justify-center gap-2.5 shadow-lg hover:opacity-95 active:scale-[0.98] transition-all cursor-pointer"
              >
                <Send className="w-4.5 h-4.5 fill-white text-primario shrink-0" />
                <span>Pedir por WhatsApp • ${totalPrice}</span>
              </button>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
