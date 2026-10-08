/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { Search, MapPin, Clock, Instagram, Star, FileText } from 'lucide-react';
import { Language, translations } from '../translations';

interface HeaderProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  onOpenCart: () => void;
  cartCount: number;
  isScrolled: boolean;
  currentLang: Language;
  onToggleLang: () => void;
  heroMediaType: 'image' | 'video';
  heroMediaUrl: string;
}

export default function Header({ 
  searchQuery, 
  setSearchQuery, 
  onOpenCart, 
  cartCount,
  isScrolled,
  currentLang,
  onToggleLang,
  heroMediaType,
  heroMediaUrl,
}: HeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const t = translations[currentLang];

  useEffect(() => {
    // Determine if open based on hours: Martes a Domingo de 19:30 a 23:30
    const checkOpen = () => {
      const now = new Date();
      const day = now.getDay(); // 0 is Sunday, 1 Monday, 2 Tuesday...
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
    <div 
      className={`w-full text-white shadow-lg flex flex-col justify-between relative select-none overflow-hidden transition-all duration-300 ${
        isScrolled 
          ? 'sticky top-0 z-30 shadow-xl py-3 px-4 pb-3.5 rounded-b-[28px] min-h-0' 
          : 'relative pt-7 px-5 pb-8 rounded-b-[40px] min-h-[310px] sm:min-h-[340px]'
      }`}
    >
      {/* Hero Media Background Layer (Photo or Video) when at top */}
      <div 
        className={`absolute inset-0 transition-opacity duration-500 pointer-events-none ${
          isScrolled ? 'opacity-0' : 'opacity-100'
        }`}
      >
        {heroMediaType === 'video' ? (
          <video
            src={heroMediaUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : (
          <img
            src={heroMediaUrl}
            alt={t.restaurantName}
            className="w-full h-full object-cover"
          />
        )}
        {/* Dark transparent gradient overlay for WCAG accessibility and legibility */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/85 via-black/55 to-black/90" />
      </div>

      {/* Primary color gradient backdrop with depth when scrolled / collapsed */}
      <div 
        className={`absolute inset-0 bg-primario transition-opacity duration-500 pointer-events-none ${
          isScrolled ? 'opacity-100' : 'opacity-0'
        }`} 
      />

      {/* Header Interactive Contents Container */}
      <div className="relative z-10 flex flex-col w-full">
        {/* Top row: Logo on left, Action buttons on right */}
        <div className={`flex items-center justify-between w-full transition-all duration-300 ${isScrolled ? 'mb-2.5' : 'mb-6'}`}>
          {/* Circular restaurant logo */}
          <div className="w-10 h-10 rounded-full bg-white/10 backdrop-blur-md border border-white/40 shadow-md flex items-center justify-center overflow-hidden shrink-0 select-none">
            <span className="text-xl" role="img" aria-label="Logo">🍕</span>
          </div>

          {/* Right Action Icons Row: Google Maps, Instagram, Review, Order Cart, Language */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* 1) Google Maps location link */}
            <a
              href="https://maps.google.com/?q=Plácido+Ellauri+3358+La+Mondiola+Montevideo"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 flex items-center justify-center text-white transition-all border border-white/20 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              title={t.googleMaps}
              aria-label={t.googleMaps}
            >
              <MapPin className="w-4 h-4 stroke-[2.2]" />
            </a>

            {/* 2) Instagram profile link */}
            <a
              href="https://www.instagram.com/bulet.pizza"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 flex items-center justify-center text-white transition-all border border-white/20 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              title={t.instagram}
              aria-label={t.instagram}
            >
              <Instagram className="w-4 h-4 stroke-[2.2]" />
            </a>

            {/* 3) Google Reviews star link */}
            <a
              href="https://search.google.com/local/writereview?placeid=ChIJ56sCsqOkt5URD6F8_3d0i-Q"
              target="_blank"
              rel="noopener noreferrer"
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full bg-white/15 hover:bg-white/25 active:scale-90 flex items-center justify-center text-white transition-all border border-white/20 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              title={t.reviews}
              aria-label={t.reviews}
            >
              <Star className="w-4 h-4 stroke-[2.2]" />
            </a>

            {/* 4) Customer order / cart receipt button */}
            <button
              onClick={onOpenCart}
              id="btn-header-cart"
              className="w-8 h-8 sm:w-8.5 sm:h-8.5 rounded-full bg-white hover:bg-gray-100 active:scale-90 text-primario flex items-center justify-center relative shadow-md transition-all cursor-pointer border border-white/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              title={t.viewCart}
              aria-label={`${t.viewCart} (${cartCount})`}
            >
              <FileText className="w-4 h-4 text-primario stroke-[2.5]" />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-red-600 text-white w-4.5 h-4.5 rounded-full flex items-center justify-center text-[8.5px] font-black pointer-events-none ring-2 ring-white">
                  {cartCount}
                </span>
              )}
            </button>

            {/* 5) Language selector switch button: ES / EN */}
            <button
              onClick={onToggleLang}
              className="px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 active:scale-90 text-white text-[11px] font-black tracking-wider transition-all border border-white/30 flex items-center justify-center cursor-pointer select-none font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
              title={currentLang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
              aria-label={currentLang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
            >
              {currentLang.toUpperCase()}
            </button>
          </div>
        </div>

        {/* Big Title Name of Restaurant (reduced size on collapse, enlarged when at top) */}
        <h1 
          className={`font-headings font-black tracking-tight text-white uppercase leading-none drop-shadow-sm transition-all duration-300 ${
            isScrolled ? 'text-xl sm:text-2xl mb-2.5' : 'text-[40px] sm:text-[48px] mb-4'
          }`}
        >
          {t.restaurantName}
        </h1>

        {/* Schedule row (collapsed when scrolling down) */}
        {!isScrolled && (
          <div className="flex items-center justify-between gap-2 mb-5 text-white/95 text-xs font-medium animate-fadeIn">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-white/80 shrink-0" />
              <span className="font-sans leading-none">{t.schedule}</span>
            </div>

            {/* Status pill badge with pulsing dot */}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider select-none border backdrop-blur-md ${
                isOpen
                  ? 'bg-emerald-950/70 border-emerald-500/50 text-emerald-300'
                  : 'bg-black/60 border-red-500/60 text-red-400'
              }`}
              title={isOpen ? t.openBadgeTitle : t.closedBadgeTitle}
            >
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isOpen ? 'bg-emerald-400' : 'bg-red-500'}`} />
                <span className={`relative inline-flex rounded-full h-2 w-2 ${isOpen ? 'bg-emerald-400' : 'bg-red-500'}`} />
              </span>
              {isOpen ? t.open : t.closed}
            </span>
          </div>
        )}

        {/* Glassmorphism Search Bar */}
        <div id="search-container" className="relative w-full">
          <input
            id="search-input"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchPlaceholder}
            className={`block w-full pl-5 pr-12 rounded-full text-sm text-white placeholder-white/80 transition-all duration-300 font-sans focus:outline-none focus:ring-2 focus:ring-white/60 glass-search ${
              isScrolled ? 'py-2 text-xs sm:text-sm' : 'py-2.5 sm:py-3'
            }`}
          />
          <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
            <Search className="h-4.5 w-4.5 text-white/85 stroke-[2.5]" />
          </div>
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute inset-y-0 right-10 pr-2 flex items-center text-xs text-white hover:text-amber-300 font-extrabold cursor-pointer"
            >
              {t.clear}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

