/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { 
  ClipboardList, 
  Pizza, 
  CupSoda, 
  Flame, 
  Sparkles, 
  ChefHat, 
  Fish, 
  Utensils, 
  Cake, 
  Beer, 
  Wine, 
  MoreHorizontal 
} from 'lucide-react';
import { CATEGORIES } from '../data';
import { Language, translations } from '../translations';

interface MenuFilterProps {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
  currentLang?: Language;
}

// Map category IDs to elegant Lucide icons
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  all: ClipboardList,
  burguers: ChefHat,
  lomos: Flame,
  pizzas: Pizza,
  sushi: Fish,
  entradas: Sparkles,
  principales: Utensils,
  postres: Cake,
  bebidas: CupSoda,
  cervezas: Beer,
  vinos: Wine,
  otros: MoreHorizontal,
};

export default function MenuFilter({ selectedCategory, setSelectedCategory, currentLang = 'es' }: MenuFilterProps) {
  const t = translations[currentLang] || translations.es;

  return (
    <div className="sticky top-0 z-20 w-full bg-[#fcf8f5]/90 dark:bg-zinc-900/95 backdrop-blur-md border-b border-gray-200/40 dark:border-zinc-800 py-4 shadow-3xs transition-colors duration-200">
      <div className="max-w-md mx-auto px-4">
        {/* Horizontal scroll grid rows */}
        <div 
          className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth pb-1 select-none"
          role="tablist"
          aria-label={currentLang === 'es' ? 'Categorías del menú' : 'Menu categories'}
        >
          {CATEGORIES.map((category) => {
            const isActive = selectedCategory === category.id;
            const IconComponent = iconMap[category.id] || ClipboardList;
            const categoryName = t.categories?.[category.id] || category.name;
            
            return (
              <button
                key={category.id}
                id={`filter-${category.id}`}
                role="tab"
                aria-selected={isActive}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex flex-col items-center justify-center py-2.5 px-4.5 rounded-2xl text-[11px] font-black tracking-tight whitespace-nowrap transition-all duration-300 transform active:scale-95 cursor-pointer border min-w-[70px] flex-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primario ${
                  isActive
                    ? 'bg-secundario text-primario border-primario shadow-xs'
                    : 'bg-white dark:bg-zinc-800 text-gray-500 dark:text-zinc-300 border-gray-200/60 dark:border-zinc-700/80 hover:text-gray-900 dark:hover:text-white dark:hover:bg-zinc-750'
                }`}
              >
                {/* Custom icon matching the category */}
                <IconComponent className={`w-5 h-5 mb-1 ${isActive ? 'text-primario' : 'text-gray-400 dark:text-zinc-400'}`} />
                <span>{categoryName}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
