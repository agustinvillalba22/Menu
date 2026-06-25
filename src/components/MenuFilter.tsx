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

interface MenuFilterProps {
  selectedCategory: string;
  setSelectedCategory: (category: string) => void;
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

export default function MenuFilter({ selectedCategory, setSelectedCategory }: MenuFilterProps) {
  return (
    <div className="sticky top-0 z-20 w-full bg-[#fcf8f5]/90 backdrop-blur-md border-b border-gray-200/40 py-4 shadow-3xs">
      <div className="max-w-md mx-auto px-4">
        {/* Horizontal scroll grid rows */}
        <div className="flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth pb-1 select-none">
          {CATEGORIES.map((category) => {
            const isActive = selectedCategory === category.id;
            const IconComponent = iconMap[category.id] || ClipboardList;
            
            return (
              <button
                key={category.id}
                id={`filter-${category.id}`}
                onClick={() => setSelectedCategory(category.id)}
                className={`flex flex-col items-center justify-center py-2.5 px-4.5 rounded-2xl text-[11px] font-black tracking-tight whitespace-nowrap transition-all duration-300 transform active:scale-95 cursor-pointer border min-w-[70px] flex-1 ${
                  isActive
                    ? 'bg-secundario text-primario border-primario shadow-xs'
                    : 'bg-white text-gray-400 border-gray-200/60 hover:text-gray-800'
                }`}
              >
                {/* Custom icon matching the category */}
                <IconComponent className={`w-5 h-5 mb-1 ${isActive ? 'text-primario' : 'text-gray-400'}`} />
                <span>{category.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
