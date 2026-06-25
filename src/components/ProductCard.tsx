/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  key?: string | number;
  product: Product;
  onSelect: (product: Product) => void;
  isLarge?: boolean;
}

export default function ProductCard({ product, onSelect, isLarge = false }: ProductCardProps) {
  const handleCardClick = () => {
    onSelect(product);
  };

  const handlePlusClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSelect(product);
  };

  // Badges container
  const badges = (
    <div className="flex flex-wrap items-center gap-1 mt-1.5">
      {product.isSpicy && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-red-50 text-red-600 border border-red-200 select-none">
          🌶️ <span className="sr-only">Picante</span>
        </span>
      )}
      {product.isVegetarian && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-600 border border-emerald-200 select-none">
          🌱 <span className="sr-only">Veggie</span>
        </span>
      )}
      {product.isGlutenFree && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-50 text-amber-600 border border-amber-200 select-none">
          🌾 <span className="sr-only">Sin TACC</span>
        </span>
      )}
    </div>
  );

  if (isLarge) {
    // --- LARGE CARD LAYOUT (Full Image Background) ---
    return (
      <div
        id={`product-card-${product.id}`}
        onClick={handleCardClick}
        className="group relative w-full h-[220px] rounded-[24px] overflow-hidden cursor-pointer shadow-md hover:shadow-lg transition-all duration-300 transform active:scale-[0.99] border border-gray-250/10 select-none"
      >
        {/* Full Image */}
        <img
          src={product.image}
          alt={product.name}
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover transform group-hover:scale-102 transition-transform duration-500"
        />

        {/* Gradient Overlay for supreme legibility of text */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent"></div>

        {/* Dynamic Plus Action overlaid top-right */}
        <div className="absolute top-4 right-4">
          <button
            id={`btn-add-quick-${product.id}`}
            onClick={handlePlusClick}
            className="w-10 h-10 rounded-full bg-white hover:bg-slate-50 active:scale-90 text-slate-900 flex items-center justify-center shadow-md transition-all cursor-pointer border border-white/20"
            title="Agregar al pedido"
          >
            <Plus className="w-5 h-5 text-slate-900 stroke-[3]" />
          </button>
        </div>

        {/* Bottom Contents (Title, Desc, Price) resembling the attached screenshot exactly */}
        <div className="absolute bottom-4 left-4 right-4 text-white flex justify-between items-end gap-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-sans text-[20px] font-bold tracking-tight leading-snug drop-shadow-md">
              {product.name}
            </h3>
            <p className="text-white/85 text-[11px] leading-relaxed line-clamp-2 pr-1 mt-1 font-sans drop-shadow-xs">
              {product.description}
            </p>
          </div>
          <span className="font-sans text-2xl font-black text-[#F9CA3F] shrink-0 drop-shadow-md pb-0.5 tracking-tight">
            ${product.price}
          </span>
        </div>
      </div>
    );
  }

  // --- SMALL CARD LAYOUT ---
  return (
    <div
      id={`product-card-${product.id}`}
      onClick={handleCardClick}
      className="group bg-white rounded-[28px] p-4 flex gap-4 cursor-pointer hover:shadow-xs transition-all duration-300 transform active:scale-[0.99] border border-gray-100 relative select-none"
    >
      {/* Left Area: Title, Description, Price, Flags */}
      <div className="flex-1 flex flex-col justify-between min-w-0 pr-2">
        <div>
          {/* Name & Badge Row */}
          <h3 className="font-sans text-[15px] font-black text-gray-900 leading-tight group-hover:text-primario transition-colors truncate">
            {product.name}
          </h3>

          {/* Sourdough Ingredients / Subtitles */}
          <p className="text-gray-400 text-[10.5px] font-medium mt-1 leading-relaxed font-sans line-clamp-2">
            {product.description}
          </p>
        </div>

        {/* Price & Icons row */}
        <div className="mt-2.5 flex items-center gap-3">
          <span className="font-sans text-[15px] font-black text-primario">
            ${product.price}
          </span>
          {/* Compact conditional icons */}
          {badges}
        </div>
      </div>

      {/* Right Area: Large beautiful Image Container with Overlaid Plus Icon */}
      <div className="relative w-24 h-24 rounded-[20px] bg-gray-50 overflow-hidden shrink-0 shadow-3xs border border-gray-50">
        <img
          src={product.image}
          alt={product.name}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transform group-hover:scale-103 transition-transform duration-500"
        />

        {/* Overlaid plus icon on the image bottom-right, exactly as requested */}
        <div className="absolute bottom-1 right-1">
          <button
            id={`btn-add-quick-${product.id}`}
            onClick={handlePlusClick}
            className="w-7 h-7 rounded-full bg-primario hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-md transition-all cursor-pointer border border-white/20"
          >
            <Plus className="w-3.5 h-3.5 text-white stroke-[3.5]" />
          </button>
        </div>

        {/* Featured Corner badge */}
        {product.featured && (
          <div className="absolute top-1 left-1 bg-primario text-white p-0.5 rounded-full shadow-xs">
            <Sparkles className="w-2 h-2 text-white fill-white" />
          </div>
        )}
      </div>
    </div>
  );
}
