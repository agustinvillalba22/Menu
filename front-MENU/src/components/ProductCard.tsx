/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useRef, useState, useEffect } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { Product } from '../types';

interface ProductCardProps {
  key?: string | number;
  product: Product;
  onSelect: (product: Product) => void;
  isLarge?: boolean;
  index?: number;
}

export default function ProductCard({ product, onSelect, isLarge = false, index = 0 }: ProductCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }

    if (!('IntersectionObserver' in window)) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (cardRef.current) {
            observer.unobserve(cardRef.current);
          }
        }
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -30px 0px',
      }
    );

    const currentEl = cardRef.current;
    if (currentEl) {
      observer.observe(currentEl);
    }

    return () => {
      if (currentEl) {
        observer.unobserve(currentEl);
      }
    };
  }, []);

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
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/70 dark:text-red-300 dark:border-red-900/60 select-none">
          🌶️ <span className="sr-only">Picante</span>
        </span>
      )}
      {product.isVegetarian && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/70 dark:text-emerald-300 dark:border-emerald-900/60 select-none">
          🌱 <span className="sr-only">Veggie</span>
        </span>
      )}
      {product.isGlutenFree && (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] font-black bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/70 dark:text-amber-300 dark:border-amber-900/60 select-none">
          🌾 <span className="sr-only">Sin TACC</span>
        </span>
      )}
    </div>
  );

  const delayMs = (index % 4) * 50;

  if (isLarge) {
    // --- LARGE CARD LAYOUT (Full Image Background) ---
    return (
      <div
        ref={cardRef}
        id={`product-card-${product.id}`}
        onClick={handleCardClick}
        style={{
          transitionDelay: isVisible ? `${delayMs}ms` : '0ms',
        }}
        className={`group relative w-full h-[220px] rounded-[24px] overflow-hidden cursor-pointer shadow-md hover:shadow-lg transition-all duration-600 ease-out transform active:scale-[0.99] border border-gray-250/10 dark:border-zinc-700/60 bg-zinc-900 select-none will-change-transform ${
          isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-[0.98]'
        }`}
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
            aria-label={`Añadir ${product.name} al pedido`}
            className="w-10 h-10 rounded-full bg-white dark:bg-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-700 active:scale-90 text-slate-900 dark:text-zinc-100 flex items-center justify-center shadow-md transition-all cursor-pointer border border-white/20 dark:border-zinc-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            title="Agregar al pedido"
          >
            <Plus className="w-5 h-5 text-slate-900 dark:text-zinc-100 stroke-[3]" />
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
          <span className="font-sans text-2xl font-black text-primario card-large-price shrink-0 drop-shadow-md pb-0.5 tracking-tight">
            ${product.price}
          </span>
        </div>
      </div>
    );
  }

  // --- SMALL CARD LAYOUT ---
  return (
    <div
      ref={cardRef}
      id={`product-card-${product.id}`}
      onClick={handleCardClick}
      style={{
        transitionDelay: isVisible ? `${delayMs}ms` : '0ms',
      }}
      className={`group bg-white dark:bg-zinc-800 rounded-[28px] p-4 flex gap-4 cursor-pointer hover:shadow-xs transition-all duration-600 ease-out transform active:scale-[0.99] border border-gray-100 dark:border-zinc-700/80 hover:dark:border-zinc-600 relative select-none will-change-transform ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-6 scale-[0.98]'
      }`}
    >
      {/* Left Area: Title, Description, Price, Flags */}
      <div className="flex-1 flex flex-col justify-between min-w-0 pr-2">
        <div>
          {/* Name & Badge Row */}
          <h3 className="font-sans text-[15px] font-black text-gray-900 dark:text-zinc-100 leading-tight group-hover:text-primario transition-colors truncate">
            {product.name}
          </h3>

          {/* Sourdough Ingredients / Subtitles */}
          <p className="text-gray-500 dark:text-zinc-300 text-[10.5px] font-medium mt-1 leading-relaxed font-sans line-clamp-2">
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
      <div className="relative w-24 h-24 rounded-[20px] bg-gray-50 dark:bg-zinc-900 overflow-hidden shrink-0 shadow-3xs border border-gray-50 dark:border-zinc-700/60">
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
            aria-label={`Añadir ${product.name} al pedido`}
            className="w-7 h-7 rounded-full bg-primario hover:scale-105 active:scale-95 text-white flex items-center justify-center shadow-md transition-all cursor-pointer border border-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario"
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
