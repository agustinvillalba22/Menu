/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, MessageSquare } from 'lucide-react';
import { CartItem } from '../types';
import { BUSINESS_COORDINATES } from '../data';

interface WhatsAppCheckoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  cartItems: CartItem[];
  totalPrice: number;
  onClearCart: () => void;
}

export default function WhatsAppCheckoutModal({
  isOpen,
  onClose,
  cartItems,
  totalPrice,
  onClearCart,
}: WhatsAppCheckoutModalProps) {
  const [customerName, setCustomerName] = useState('');
  const [orderType, setOrderType] = useState<'mesa' | 'llevar' | 'envio'>('mesa');
  const [tableNumber, setTableNumber] = useState('');
  const [address, setAddress] = useState('');
  const [remarks, setRemarks] = useState('');

  if (!isOpen) return null;

  // Build the WhatsApp message payload
  const buildWhatsAppLink = () => {
    let orderDetails = `*🍕 NUEVO PEDIDO - LA PIZZERIA 🍕*\n`;
    orderDetails += `------------------------------------\n`;
    orderDetails += `👤 *Cliente:* ${customerName || 'No especificado'}\n`;
    
    if (orderType === 'mesa') {
      orderDetails += `📍 *Tipo:* Consumo en Mesa 🍽️\n`;
      orderDetails += `🪑 *Mesa N°:* ${tableNumber || 'No especificada'}\n`;
    } else if (orderType === 'llevar') {
      orderDetails += `📍 *Tipo:* Para Llevar (Take Away) 📦\n`;
    } else if (orderType === 'envio') {
      orderDetails += `📍 *Tipo:* Envío a Domicilio 🛵\n`;
      orderDetails += `🏠 *Dirección:* ${address || 'No especificada'}\n`;
    }

    orderDetails += `------------------------------------\n\n`;
    orderDetails += `*🛒 RESUMEN DEL PEDIDO:*\n`;

    cartItems.forEach((item, index) => {
      const extras = item.selectedModifiers.filter((m) => m.type === 'extra');
      
      const itemBasePrice = item.product.price;
      const itemExtrasSum = extras.reduce((sum, m) => sum + m.price, 0);
      const itemTotalPrice = (itemBasePrice + itemExtrasSum) * item.quantity;

      orderDetails += `${index + 1}. *${item.product.name}* x${item.quantity} \n`;
      orderDetails += `   _Base: $${itemBasePrice}_ \n`;

      if (extras.length > 0) {
        orderDetails += `   + Extras: ${extras.map((m) => `_${m.name} (+$${m.price})_`).join(', ')}\n`;
      }
      if (item.specialInstructions) {
        orderDetails += `   ✍️ Nota: "${item.specialInstructions}"\n`;
      }
      orderDetails += `   *Subtotal: $${itemTotalPrice}*\n\n`;
    });

    orderDetails += `------------------------------------\n`;
    if (remarks.trim()) {
      orderDetails += `💬 *Comentarios Adicionales:* ${remarks.trim()}\n`;
      orderDetails += `------------------------------------\n`;
    }
    orderDetails += `*💵 TOTAL A PAGAR: $${totalPrice}*\n`;
    orderDetails += `------------------------------------\n`;
    orderDetails += `_El pago se coordinará de forma externa._\n`;
    orderDetails += `¡Muchas gracias! ❤️`;

    const encodedText = encodeURIComponent(orderDetails);
    return `https://wa.me/${BUSINESS_COORDINATES.phone}?text=${encodedText}`;
  };

  const handleConfirm = () => {
    // Clear cart after delay so the user sends the message
    setTimeout(() => {
      onClearCart();
      onClose();
    }, 1500);
  };

  const isFormValid = () => {
    if (!customerName.trim()) return false;
    if (orderType === 'mesa' && !tableNumber.trim()) return false;
    if (orderType === 'envio' && !address.trim()) return false;
    return true;
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
        {/* Backdrop overlay */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 cursor-pointer"
        />

        {/* Modal panel containing form details */}
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="relative bg-white w-full max-w-md rounded-[32px] p-6 shadow-2xl flex flex-col z-10 border-t-4 border-primario overflow-y-auto max-h-[90vh]"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 cursor-pointer w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:scale-105 transition-transform"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-3 mb-5 pt-2">
            <div className="w-10 h-10 rounded-full bg-secundario flex items-center justify-center text-primario">
              <MessageSquare className="w-5 h-5 text-primario" />
            </div>
            <div>
              <h3 className="font-sans text-lg font-black text-gray-900 leading-tight uppercase">
                Detalles del Pedido
              </h3>
              <p className="text-[9px] text-primario font-sans font-extrabold uppercase tracking-widest leading-none mt-1">
                ESTAMOS LISTOS PARA SERVIRTE
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {/* Customer name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">
                Tu Nombre *
              </label>
              <input
                type="text"
                placeholder="Ej: Sofía Martínez"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                className="w-full px-4 py-3 text-xs bg-[#f5f5f0] text-gray-800 border border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-primario focus:bg-white transition-all shadow-3xs"
                required
              />
            </div>

            {/* Selection of consumption type */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">
                ¿Dónde vas a comer? *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setOrderType('mesa')}
                  className={`p-3 rounded-2xl border text-center transition-all text-xs font-bold cursor-pointer flex flex-col items-center gap-1.5 ${
                    orderType === 'mesa'
                      ? 'border-2 border-primario bg-secundario text-primario scale-102 font-black shadow-xs'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-350'
                  }`}
                >
                  <span className="text-base">🍽️</span>
                  <span>En la Mesa</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('llevar')}
                  className={`p-3 rounded-2xl border text-center transition-all text-xs font-bold cursor-pointer flex flex-col items-center gap-1.5 ${
                    orderType === 'llevar'
                      ? 'border-2 border-primario bg-secundario text-primario scale-102 font-black shadow-xs'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-350'
                  }`}
                >
                  <span className="text-base">📦</span>
                  <span>Para Llevar</span>
                </button>
                <button
                  type="button"
                  onClick={() => setOrderType('envio')}
                  className={`p-3 rounded-2xl border text-center transition-all text-xs font-bold cursor-pointer flex flex-col items-center gap-1.5 ${
                    orderType === 'envio'
                      ? 'border-2 border-primario bg-secundario text-primario scale-102 font-black shadow-xs'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-gray-350'
                  }`}
                >
                  <span className="text-base">🛵</span>
                  <span>Envío</span>
                </button>
              </div>
            </div>

            {/* Input fields based on selection */}
            {orderType === 'mesa' && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">
                  Número de Mesa *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Mesa 2 / Terraza"
                  value={tableNumber}
                  onChange={(e) => setTableNumber(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-[#f5f5f0] text-gray-800 border border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-primario focus:bg-white transition-all shadow-3xs"
                  required
                />
              </div>
            )}

            {orderType === 'envio' && (
              <div className="space-y-1.5 animate-fadeIn">
                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">
                  Dirección de Entrega *
                </label>
                <input
                  type="text"
                  placeholder="Ej: Av. Brasil 2984 Ap. 401"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-4 py-3 text-xs bg-[#f5f5f0] text-gray-800 border border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-primario focus:bg-white transition-all shadow-3xs"
                  required
                />
              </div>
            )}

            {/* Extra remarks or instructions */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-400 uppercase tracking-widest block">
                Comentarios sobre el pago / entrega
              </label>
              <textarea
                placeholder="Ej: Pago con tarjeta de débito / Traer cambio de $1000..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 text-xs bg-[#f5f5f0] text-gray-800 border border-transparent rounded-2xl focus:outline-none focus:ring-2 focus:ring-primario focus:bg-white placeholder-gray-450 transition-all shadow-3xs"
              />
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-gray-150 space-y-4 font-sans">
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-gray-500">Monto del pedido:</span>
              <span className="font-mono text-xl font-black text-primario">${totalPrice}</span>
            </div>

            <p className="text-[10px] text-gray-400 leading-relaxed">
              Al hacer click, se estructurará un mensaje de WhatsApp para que se lo envíes directamente al restaurante. ¡Ellos confirmarán tu pedido enseguida!
            </p>

            {/* Standard link checkout mimicking custom safe navigation */}
            <a
              id="btn-whatsapp-confirm"
              href={isFormValid() ? buildWhatsAppLink() : '#'}
              onClick={isFormValid() ? handleConfirm : undefined}
              target={isFormValid() ? '_blank' : undefined}
              rel="noreferrer"
              className={`w-full inline-flex items-center justify-center gap-2.5 py-4 px-5 rounded-2xl font-bold text-base text-center text-white transition-all cursor-pointer shadow-lg ${
                isFormValid()
                  ? 'bg-emerald-600 hover:brightness-110 active:scale-[0.98] shadow-emerald-600/30'
                  : 'bg-gray-200 text-gray-450 cursor-not-allowed shadow-none border border-transparent'
              }`}
            >
              <MessageSquare className="w-5 h-5 fill-white text-emerald-600" />
              <span>Enviar Pedido por WhatsApp</span>
            </a>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
