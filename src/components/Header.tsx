/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Search, MapPin, Clock, ShoppingBag } from 'lucide-react';
import { motion } from 'motion/react';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenCart: () => void;
  cartCount: number;
}

export default function Header({ searchQuery, setSearchQuery, onOpenCart, cartCount }: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    // Determine if open based on hours: Martes a Domingo de 19:30 a 23:30
    const checkOpen = () => {
      const now = new Date();
      const day = now.getDay(); // 0 is Sunday, 1 Monday, 2 Tuesday...
      const minutesSinceMidnight = now.getHours() * 65 / 60; // Wait, correct hour calc:
      const currentMinutes = now.getHours() * 60 + now.getMinutes();
      
      const isOpenDay = day !== 1; // Not Monday (Lunes cerrado)
      const openTime = 19 * 60 + 30; // 19:30
      const closeTime = 23 * 60 + 30; // 23:30
      
      const isOpenHour = currentMinutes >= openTime && currentMinutes <= closeTime;
      setIsOpen(isOpenDay && isOpenHour);
    };

    checkOpen();
    const interval = setInterval(checkOpen, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="bg-primario text-white p-6 pb-8 rounded-b-[40px] shadow-md flex flex-col relative select-none">
      {/* Top row: Logo on left, Cart Button on right */}
      <div className="flex items-center justify-between w-full mb-6">
        {/* Rounded white logo of the local with bread/baguette emoji */}
        <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center p-1 shadow-md border border-white/10 relative">
          <span className="text-2.5xl" role="img" aria-label="Boulette logo">🥖</span>
        </div>

        {/* Circular cart button on the right */}
        <button
          onClick={onOpenCart}
          className="w-11 h-11 rounded-full bg-white hover:bg-gray-50 flex items-center justify-center relative shadow-md cursor-pointer transition-all active:scale-95"
          title="Ver Pedido"
          id="btn-header-cart"
        >
          <ShoppingBag className="w-5 h-5 text-primario stroke-[2.5]" />
          {cartCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-black pointer-events-none ring-2 ring-white">
              {cartCount}
            </span>
          )}
        </button>
      </div>

      {/* Big Title Name of Restaurant */}
      <h1 className="font-headings text-4xl font-bold tracking-tight text-white mb-5 uppercase leading-none drop-shadow-xs">
        Boulette
      </h1>

      {/* Info Rows & Indicators Container */}
      <div className="flex items-end justify-between gap-4 w-full mb-6">
        <div className="flex flex-col gap-2.5 text-white/95 text-xs font-medium">
          {/* Schedule */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-white/80 shrink-0" />
            <span className="font-sans leading-none">
              Martes a Domingo 19:30 - 23:30 hs
            </span>
          </div>
          {/* Address */}
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-white/80 shrink-0" />
            <span className="font-sans leading-none">
              Plácido Ellauri 3358, La Mondiola
            </span>
          </div>
        </div>

        {/* Dynamic Open / Closed pill badge featuring micro-interactions */}
        <div className="shrink-0 mb-0.5">
          {isOpen ? (
            <motion.span
              key="abierto-badge"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.08, y: -1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 450, damping: 15 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#e6fbf3] text-[#00875a] shadow-xs cursor-pointer select-none origin-right"
              title="¡Estamos abiertos! Haz tu pedido"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00875a] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00875a]"></span>
              </span>
              ABIERTO
            </motion.span>
          ) : (
            <motion.span
              key="cerrado-badge"
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.08, y: -1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 450, damping: 15 }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#ffe8e5] text-[#fc462f] shadow-xs cursor-pointer select-none origin-right"
              title="Local cerrado de momento"
            >
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#fc462f] opacity-40"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#fc462f]"></span>
              </span>
              CERRADO
            </motion.span>
          )}
        </div>
      </div>

      {/* Pill Shaped Search bar with icon on the RIGHT side exactly like the image */}
      <div id="search-container" className="relative w-full">
        <input
          id="search-input"
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar producto"
          className="block w-full pl-5 pr-12 py-3 border border-transparent bg-white text-gray-800 placeholder-gray-400 text-sm rounded-full focus:outline-none focus:ring-2 focus:ring-amber-400 focus:bg-white shadow-md transition-all duration-300 font-sans"
        />
        <div className="absolute inset-y-0 right-0 pr-4.5 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-gray-400 stroke-[2.5]" />
        </div>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute inset-y-0 right-10 pr-2 flex items-center text-xs text-primario hover:text-black font-extrabold cursor-pointer"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
}
