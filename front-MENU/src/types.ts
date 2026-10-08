/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Ingredient {
  name: string;
  icon: string; // The Lucide icon string or short emoji descriptor
}

export interface Modifier {
  id: string;
  name: string;
  price: number; // 0 for optional removals, >0 for extra toppings
  type: 'extra' | 'removal'; // extra adds price, removal lets customer customize
}

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  originalPrice?: number; // Optional flag to show crossed out original price in UI (e.g. for promotions)
  isPromo?: boolean; // Optional flag to indicate customized promotion status
  category: string;
  subcategory?: string; // e.g. "A base de tomate (Salsa Pomodoro)" or "A base de mousseline (Salsa Emulsionada)" or "Sin alcohol"
  image: string;
  ingredients: Ingredient[];
  modifiers: Modifier[];
  featured?: boolean;
  isSpicy?: boolean;
  isGlutenFree?: boolean;
  isVegetarian?: boolean;
}

export interface CartItem {
  id: string; // unique item id in cart (product.id + modifiers selected)
  product: Product;
  quantity: number;
  selectedModifiers: Modifier[];
  specialInstructions?: string;
}
