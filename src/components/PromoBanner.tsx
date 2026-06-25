/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { motion } from 'motion/react';

interface PromoBannerProps {
  onClick?: () => void;
}

export default function PromoBanner({ onClick }: PromoBannerProps) {
  return (
    <div className="px-4 py-2">
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={{ y: -3, scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: 'spring', stiffness: 350, damping: 20 }}
        onClick={onClick}
        className="group relative flex w-full h-[125px] sm:h-[135px] rounded-[22px] overflow-hidden bg-[#FED130] shadow-md hover:shadow-lg transition-shadow duration-300 border border-[#FED130]/20 select-none cursor-pointer"
      >
        {/* Shine highlight effect overlay that flows across on hover */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-10 rounded-[22px]">
          <div className="absolute top-0 -inset-full h-full w-1/2 block transform -skew-x-12 bg-gradient-to-r from-transparent to-white/20 opacity-0 group-hover:animate-shine" />
        </div>

        {/* Left Side: Solid Yellow with precise content and alignment */}
        <div className="w-[45%] sm:w-[50%] flex flex-col justify-center pl-6 pr-3 py-3 text-black z-10">
          <motion.div 
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ repeat: Infinity, repeatType: 'reverse', duration: 1.5, ease: 'easeInOut' }}
            className="font-sans font-black text-[28px] sm:text-[34px] leading-none tracking-tighter text-[#000000] select-none"
          >
            20% OFF
          </motion.div>
          <div className="font-sans font-bold text-[12px] sm:text-[14px] leading-tight text-[#000000] mt-1 line-clamp-1">
            Burger Cheddar Especial
          </div>
          <div className="font-sans text-[10px] sm:text-[11px] leading-snug text-black/80 mt-1 line-clamp-2 max-w-[95%]">
            Pide el plato del día y obtenga un 20% de descuento
          </div>
        </div>

        {/* Right Side: Crop Image with hover scale zoom-in */}
        <div className="w-[55%] sm:w-[50%] relative overflow-hidden h-full bg-stone-900">
          <img
            src="https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop"
            alt="Burger Cheddar Especial"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-106 transition-transform duration-700 ease-out"
          />
          {/* Subtle gradient overlay to smoothly transition image to yellow background on mobile screens */}
          <div className="absolute inset-y-0 left-0 w-8 bg-gradient-to-r from-[#FED130] to-transparent pointer-events-none" />

          {/* Micro-interaction: Flashing live-tag at top right */}
          <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-black/75 text-white backdrop-blur-xs shadow-xs">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500"></span>
            </span>
            HOY
          </span>
        </div>
      </motion.div>
    </div>
  );
}

