/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Product, Modifier } from './types';

// Shared common modifiers
const standardRemovals: Modifier[] = [
  { id: 'rem-albahaca', name: 'Sin Albahaca 🌿', price: 0, type: 'removal' },
  { id: 'rem-salsa', name: 'Sin Salsa 🥫', price: 0, type: 'removal' },
];

const standardExtras: Modifier[] = [
  { id: 'ext-queso', name: 'Extra Muzzarella 🧀', price: 80, type: 'extra' },
  { id: 'ext-bacon', name: 'Extra Panceta Crujiente 🥓', price: 100, type: 'extra' },
  { id: 'ext-huevo', name: 'Agregar Huevo Frito 🍳', price: 50, type: 'extra' },
];

export const CATEGORIES = [
  { id: 'all', name: 'Todo' },
  { id: 'burguers', name: 'Burgers' },
  { id: 'lomos', name: 'Lomos' },
  { id: 'pizzas', name: 'Pizzas' },
  { id: 'sushi', name: 'Sushi' },
  { id: 'entradas', name: 'Entradas' },
  { id: 'principales', name: 'Principales' },
  { id: 'postres', name: 'Postres' },
  { id: 'bebidas', name: 'Bebidas' },
  { id: 'cervezas', name: 'Cervezas' },
  { id: 'vinos', name: 'Vinos' },
  { id: 'otros', name: 'Otros' },
];

export const PRODUCTS: Product[] = [
  // --- BURGUERS ---
  {
    id: 'burger-cheddar-especial',
    name: 'Burger Cheddar Especial',
    description: 'Doble carne smash premium, triple cheddar americano fundido, panceta súper crujiente y salsa secreta de la casa en pan brioche esponjoso tostado con manteca.',
    price: 650,
    category: 'burguers',
    subcategory: 'Smash Burgers',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Carne Smash', icon: '🥩' },
      { name: 'Queso Cheddar', icon: '🧀' },
      { name: 'Panceta', icon: '🥓' }
    ],
    modifiers: [
      ...standardExtras,
      { id: 'rem-bacon-b', name: 'Sin Panceta 🥓', price: 0, type: 'removal' }
    ],
    featured: true,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: false
  },
  {
    id: 'burger-crispy-onion',
    name: 'Burger Crispy Onion',
    description: 'Doble carne seleccionada, queso cheddar, crujientes aros de cebolla fritos, salsa barbacoa ahumada y un toque de jalapeños picantes marinados.',
    price: 680,
    category: 'burguers',
    subcategory: 'Smash Burgers',
    image: 'https://images.unsplash.com/photo-1553979459-d2229ba7433b?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Carne Smash', icon: '🥩' },
      { name: 'Cebolla Crispy', icon: '🧅' },
      { name: 'Salsa Barbacoa', icon: '🥫' }
    ],
    modifiers: [
      ...standardExtras,
      { id: 'rem-jalapeno', name: 'Sin Jalapeños 🌶️', price: 0, type: 'removal' }
    ],
    featured: false,
    isSpicy: true,
    isGlutenFree: false,
    isVegetarian: false
  },
  {
    id: 'burger-premium-clasica',
    name: 'Burger Premium Clásica',
    description: 'Medallón de carne de 150g madurada, queso dambo derretido, lechuga capuchina fresca, rodajas de tomate seleccionado y aderezo criollo tradicional.',
    price: 550,
    category: 'burguers',
    subcategory: 'Clásicas',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Carne Vacuna', icon: '🥩' },
      { name: 'Lechuga y Tomate', icon: '🥬' },
      { name: 'Aderezo Criollo', icon: '🥫' }
    ],
    modifiers: [
      ...standardExtras,
      { id: 'rem-tomate', name: 'Sin Tomate 🍅', price: 0, type: 'removal' }
    ],
    featured: false,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: false
  },
  {
    id: 'burger-vegana',
    name: 'Burger Vegana de Lentejas',
    description: 'Medallón artesanal a base de lentejas orgánicas y quinoa, muzzarella vegana derretida, palta fileteada fresca, rúcula fresca y mayonesa vegana en pan sin gluten.',
    price: 620,
    category: 'burguers',
    subcategory: 'Opciones Saludables',
    image: 'https://images.unsplash.com/photo-1547584370-2cc98b8b8dc8?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Quinoa & Lentejas', icon: '🌾' },
      { name: 'Palta fresca', icon: '🥑' },
      { name: 'Muzzarella vegana', icon: '🧀' }
    ],
    modifiers: [
      { id: 'ext-palta', name: 'Extra Palta 🥑', price: 80, type: 'extra' },
      { id: 'rem-mayo', name: 'Sin Mayonesa Vegana 🥫', price: 0, type: 'removal' }
    ],
    featured: true,
    isSpicy: false,
    isGlutenFree: true,
    isVegetarian: true
  },
  {
    id: 'burger-blue-cheese',
    name: 'Burger Blue Cheese',
    description: 'Doble carne smash, queso azul cremoso fundido, cebolla caramelizada suave artesanal, rúcula silvestre fresca y mayonesa alioli en pan brioche.',
    price: 690,
    category: 'burguers',
    subcategory: 'Gourmet',
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Carne Smash', icon: '🥩' },
      { name: 'Queso Azul', icon: '🧀' },
      { name: 'Cebolla Caramelizada', icon: '🧅' }
    ],
    modifiers: [...standardExtras],
    featured: false,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: false
  },
  {
    id: 'burger-triple-smash',
    name: 'Triple Cheddar Tower Smash',
    description: 'Triple medallón de carne de ternera smash con costra súper crocante, séxtuple queso cheddar fundido, pepinillos en vinagre y salsa secreta de la casa.',
    price: 790,
    category: 'burguers',
    subcategory: 'Smash Burgers',
    image: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Triple Carne', icon: '🥩' },
      { name: 'Súper Cheddar', icon: '🧀' },
      { name: 'Pepinillos', icon: '🥒' }
    ],
    modifiers: [...standardExtras],
    featured: true,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: false
  },
  {
    id: 'burger-bbq-bacon',
    name: 'Burger BBQ Bacon Extra',
    description: 'Doble medallón premium jugoso de 120g, doble porción de panceta ahumada crocante, queso cheddar americano, crujientes aros de cebolla y salsa barbacoa stout.',
    price: 720,
    category: 'burguers',
    subcategory: 'Gourmet',
    image: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Doble Carne', icon: '🥩' },
      { name: 'Doble Panceta', icon: '🥓' },
      { name: 'Salsa Barbacoa', icon: '🥫' }
    ],
    modifiers: [...standardExtras],
    featured: false,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: false
  },
  {
    id: 'burger-egg-truffle',
    name: 'Burger Trufada & Huevo',
    description: 'Doble carne smash seleccionada, huevo de campo frito con yema blanda, queso provolone ahumado, rúcula fresca y mayonesa perfumada con aceite de trufa blanca.',
    price: 740,
    category: 'burguers',
    subcategory: 'Gourmet',
    image: 'https://images.unsplash.com/photo-1550547660-d9450f859349?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Huevo Frito', icon: '🍳' },
      { name: 'Queso Provolone', icon: '🧀' },
      { name: 'Mayonesa Trufada', icon: '🍄' }
    ],
    modifiers: [...standardExtras],
    featured: false,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: false
  },
  {
    id: 'burger-doble-provo',
    name: 'Burger Doble Provoleta',
    description: 'Doble medallón de ojo de bife madurado, provoleta dorada crocante al orégano, pimientos rojos asados bien dulces al oliva y chimichurri suave de la casa.',
    price: 750,
    category: 'burguers',
    subcategory: 'Gourmet',
    image: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Doble Carne de Ojo de Bife', icon: '🥩' },
      { name: 'Provoleta Asada', icon: '🧀' },
      { name: 'Pimientos Dulces', icon: '🫑' }
    ],
    modifiers: [...standardExtras],
    featured: false,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: false
  },

  // --- LOMOS ---
  {
    id: 'lomo-completo-pizza',
    name: 'Lomo Completo en Pan de Pizza',
    description: 'Exquisito lomo de ternera tiernizado a la plancha, muzzarella hilada derretida, jamón cocido seleccionado, huevo frito con yema blanda, lechuga y tomate en nuestro pan de masa madre horneado al momento.',
    price: 850,
    category: 'lomos',
    subcategory: 'Lomos Premium',
    image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Lomo de ternera', icon: '🥩' },
      { name: 'Pan de masa madre', icon: '🥖' },
      { name: 'Huevo frito', icon: '🍳' }
    ],
    modifiers: [
      ...standardExtras,
      { id: 'rem-huevo', name: 'Sin Huevo Frito 🍳', price: 0, type: 'removal' }
    ],
    featured: true,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: false
  },
  {
    id: 'lomo-criollo-picante',
    name: 'Lomo Criollo Picante',
    description: 'Finas lonjas de lomo de ternera salteadas con cebolla, morrón asado y chimichurri picante de la casa, gratinado con queso provolone fundido en pan de pizza artesanal.',
    price: 890,
    category: 'lomos',
    subcategory: 'Lomos Premium',
    image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Lomo picado', icon: '🥩' },
      { name: 'Queso Provolone', icon: '🧀' },
      { name: 'Chimichurri Picante', icon: '🌶' }
    ],
    modifiers: [
      ...standardExtras,
      { id: 'rem-chimi', name: 'Sin Chimichurri 🌶', price: 0, type: 'removal' }
    ],
    featured: false,
    isSpicy: true,
    isGlutenFree: false,
    isVegetarian: false
  },
  {
    id: 'lomo-simple-dambo',
    name: 'Lomo Simple Dambo',
    description: 'Finas fetas de lomo tierno selladas a la plancha, cubiertas con doble queso dambo derretido en pan rústico, simple y reconfortante.',
    price: 750,
    category: 'lomos',
    subcategory: 'Lomos Clásicos',
    image: 'https://images.unsplash.com/photo-1509722747041-616f39b57569?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Lomo Vacuno', icon: '🥩' },
      { name: 'Queso Dambo', icon: '🧀' }
    ],
    modifiers: [
      ...standardExtras
    ],
    featured: false,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: false
  },

  // --- PIZZAS ---
  {
    id: 'pizza-margarita-premium',
    name: 'Pizza Margarita Premium',
    description: 'Nuestra pizza estrella de masa madre napolitana madurada 48 horas en frío. Salsa pomodoro casera elaborada con tomates seleccionados, abundante mozzarella hilada, hojas de albahaca fresca y un hilo de aceite extra virgen.',
    price: 550,
    category: 'pizzas',
    subcategory: 'Pizzas Artesanales',
    image: '/src/assets/images/margherita_pizza_classic_1779394389069.png',
    ingredients: [
      { name: 'Salsa Pomodoro', icon: '🍅' },
      { name: 'Muzzarella', icon: '🧀' },
      { name: 'Albahaca fresca', icon: '🌿' }
    ],
    modifiers: [
      { id: 'ext-peperoni', name: 'Agregar Peperoni 🥩', price: 90, type: 'extra' },
      ...standardRemovals
    ],
    featured: true,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: true
  },
  {
    id: 'pizza-peperoni-aji-miel',
    name: 'Pizza Peperoni con Miel de Ají',
    description: 'Salsa pomodoro natural, muzzarella derretida, abundante salami pepperoni cortado fino y crujiente al horno de barro, terminado con un hilo dulce y picante de nuestra miel de ají casera.',
    price: 640,
    category: 'pizzas',
    subcategory: 'Pizzas Artesanales',
    image: 'https://images.unsplash.com/photo-1628840042765-356cda07504e?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Pomodoro', icon: '🍅' },
      { name: 'Pepperoni', icon: '🥩' },
      { name: 'Miel de Ají', icon: '🌶' }
    ],
    modifiers: [
      ...standardRemovals,
      { id: 'rem-miel', name: 'Sin Miel de Ají 🍯', price: 0, type: 'removal' }
    ],
    featured: true,
    isSpicy: true,
    isGlutenFree: false,
    isVegetarian: false
  },
  {
    id: 'pizza-rucula-parmesano',
    name: 'Pizza de Rúcula y Jamón Crudo',
    description: 'Base de pomodoro italiano y mozzarella fundida, cubierta después de la cocción con finas fetas de jamón crudo premium, hojas de rúcula fresca seleccionadas y lascas de queso parmesano curado.',
    price: 680,
    category: 'pizzas',
    subcategory: 'Pizzas Gourmet',
    image: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Pomodoro', icon: '🍅' },
      { name: 'Jamón Crudo', icon: '🥩' },
      { name: 'Rúcula fresca', icon: '🌱' },
      { name: 'Lascas de Parmesano', icon: '🧀' }
    ],
    modifiers: [
      ...standardRemovals,
      { id: 'rem-jamon', name: 'Sin Jamón Crudo 🥩', price: 0, type: 'removal' }
    ],
    featured: false,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: false
  },

  // --- SUSHI ---
  {
    id: 'sushi-phila-roll',
    name: 'Phila Roll Premium x10',
    description: 'Rolls premium de salmón fresco curado de la casa, suave queso crema y palta madura, envueltos en sésamo tostado de dos colores. Servido con salsa de soja extra.',
    price: 690,
    category: 'sushi',
    subcategory: 'Uramaki',
    image: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Salmón Fresco', icon: '🐟' },
      { name: 'Queso Crema', icon: '🧀' },
      { name: 'Palta', icon: '🥑' }
    ],
    modifiers: [
      { id: 'ext-salsa-teriyaki', name: 'Agregar Salsa Teriyaki 🍯', price: 40, type: 'extra' },
      { id: 'rem-sesamo', name: 'Sin Sésamo 🌾', price: 0, type: 'removal' }
    ],
    featured: true,
    isSpicy: false,
    isGlutenFree: true,
    isVegetarian: false
  },

  // --- ENTRADAS ---
  {
    id: 'papas-rusticas-bravas',
    name: 'Papas Rústicas Bravas',
    description: 'Gajos de papas rústicas crujientes con piel, horneadas a la perfección y acompañadas de salsa brava picante tradicional y alioli suave casero.',
    price: 320,
    category: 'entradas',
    subcategory: 'Para Compartir',
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Papas Rústicas', icon: '🥔' },
      { name: 'Salsa Brava', icon: '🌶' },
      { name: 'Alioli Casero', icon: '🧄' }
    ],
    modifiers: [
      { id: 'rem-brava', name: 'Sin Salsa Brava 🌶', price: 0, type: 'removal' },
      { id: 'rem-alioli', name: 'Sin Alioli 🧄', price: 0, type: 'removal' }
    ],
    featured: true,
    isSpicy: true,
    isGlutenFree: true,
    isVegetarian: true
  },
  {
    id: 'bastones-muzzarella',
    name: 'Bastones de Muzzarella',
    description: 'Crujientes bastones de queso muzzarella rebozados en panko con finas hierbas, fritos hasta quedar perfectamente dorados e hilados. Acompañados de dip de pomodoro casero.',
    price: 350,
    category: 'entradas',
    subcategory: 'Para Compartir',
    image: 'https://images.unsplash.com/photo-1531749668029-2db88e4b76cf?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Bastones Muzzarella', icon: '🧀' },
      { name: 'Rebozado Panko', icon: '🌾' },
      { name: 'Salsa Pomodoro', icon: '🍅' }
    ],
    modifiers: [],
    featured: false,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: true
  },
  {
    id: 'empanadas-criollas-pack',
    name: 'Empanadas Criollas Tradicionales',
    description: 'Pack de dos tradicionales empanadas uruguayas rellenas de jugosa carne vacuna cortada a cuchillo, cebolla de verdeo, huevo duro y aceitunas, sazonadas con comino y pimentón dulce.',
    price: 280,
    category: 'entradas',
    subcategory: 'Individuales',
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Carne a Cuchillo', icon: '🥩' },
      { name: 'Huevo y Aceituna', icon: '🥚' },
      { name: 'Masa Hojaldrada', icon: '🌾' }
    ],
    modifiers: [],
    featured: false,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: false
  },
  {
    id: 'aros-cebolla-crispy',
    name: 'Aros de Cebolla Crujientes',
    description: 'Anillos de cebolla tierna rebozados en panko crujiente y fritos a la dorada perfección. Acompañados de un aderezo de barbacoa ahumada.',
    price: 290,
    category: 'entradas',
    subcategory: 'Para Compartir',
    image: 'https://images.unsplash.com/photo-1639024471283-2bc7a3c75015?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Cebolla dulce', icon: '🧅' },
      { name: 'Barbacoa', icon: '🥫' }
    ],
    modifiers: [],
    featured: false,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: true
  },
  {
    id: 'nachos-con-queso',
    name: 'Nachos con Queso Fundido',
    description: 'Fritos de maíz crujientes estilo mexicano bañados en una suave y deliciosa salsa de queso cheddar caliente y ciboulette fresco picado.',
    price: 340,
    category: 'entradas',
    subcategory: 'Para Compartir',
    image: 'https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Totopos de maíz', icon: '🌽' },
      { name: 'Cheddar fundido', icon: '🧀' }
    ],
    modifiers: [],
    featured: false,
    isSpicy: false,
    isGlutenFree: true,
    isVegetarian: true
  },

  // --- PRINCIPALES ---
  {
    id: 'sorrentinos-caseros-pomodoro',
    name: 'Sorrentinos Integrales de Jamón y Queso',
    description: 'Sorrentinos gigantes de elaboración propia rellenos de jamón cocido seleccionado y queso muzzarella cremosa, servidos con salsa pomodoro tradicional espesada al horno de barro.',
    price: 650,
    category: 'principales',
    subcategory: 'Pastas de la Casa',
    image: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Sorrentinos Caseros', icon: '🌾' },
      { name: 'Salsa Pomodoro', icon: '🍅' }
    ],
    modifiers: [],
    featured: false,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: false
  },

  // --- POSTRES ---
  {
    id: 'postre-volcan-chocolate',
    name: 'Volcán de Chocolate',
    description: 'Biscocho tierno de cacao amargo con corazón líquido de chocolate belga fundido, servido tibio con un toque de azúcar impalpable.',
    price: 360,
    category: 'postres',
    subcategory: 'Dulces de la Casa',
    image: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Cacao Caliente', icon: '🍫' }
    ],
    modifiers: [],
    featured: true,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: true
  },

  // --- BEBIDAS ---
  {
    id: 'refresco-latas-cold',
    name: 'Refresco en Lata',
    description: 'Refresco en lata helada de 354ml, ideal para acompañar tus comidas y limpiar el paladar con tus sabores favoritos.',
    price: 150,
    category: 'bebidas',
    subcategory: 'Gaseosas',
    image: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?q=80&w=600&auto=format&fit=crop',
    ingredients: [{ name: 'Lata fría', icon: '🥤' }],
    modifiers: [
      { id: 'coca-comun', name: 'Coca-Cola Clásica 🔴', price: 0, type: 'removal' },
      { id: 'coca-zero', name: 'Coca-Cola Zero ⚫', price: 0, type: 'removal' },
      { id: 'fanta-orange', name: 'Fanta Naranja 🟠', price: 0, type: 'removal' }
    ],
    featured: false,
    isSpicy: false,
    isGlutenFree: true,
    isVegetarian: true
  },
  {
    id: 'limonada-menta-jengibre-f',
    name: 'Limonada de Jengibre y Menta',
    description: 'Limonada artesanal exprimida al momento con limones jugosos seleccionados de estación, agua pura fresca, menta picada y el inconfundible de jengibre tierno rallado.',
    price: 200,
    category: 'bebidas',
    subcategory: 'Bebidas Sin Alcohol',
    image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=600&auto=format&fit=crop',
    ingredients: [
      { name: 'Limón Natural', icon: '🍋' },
      { name: 'Menta Fresca', icon: '🌿' },
      { name: 'Jengibre Rallado', icon: '🫚' }
    ],
    modifiers: [
      { id: 'rem-menta', name: 'Sin Menta 🌿', price: 0, type: 'removal' },
      { id: 'rem-jengibre', name: 'Sin Jengibre 🫚', price: 0, type: 'removal' }
    ],
    featured: true,
    isSpicy: false,
    isGlutenFree: true,
    isVegetarian: true
  },

  // --- CERVEZAS ---
  {
    id: 'cerveza-artesanal-local',
    name: 'Cerveza IPA Artesanal',
    description: 'Cerveza artesanal tirada premium lata de 473ml de excelente productor local. Súper aromática, notas tropicales cítricas y amargor balanceado de lúpulos importados.',
    price: 280,
    category: 'cervezas',
    subcategory: 'Cervezas',
    image: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?q=80&w=600&auto=format&fit=crop',
    ingredients: [{ name: 'Malta y Lúpulo', icon: '🍺' }],
    modifiers: [],
    featured: false,
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: true
  },

  // --- VINOS ---
  {
    id: 'vino-tannat-reserve',
    name: 'Vino Tannat Reserva de la Casa',
    description: 'Botella de 750ml. Nuestro Tannat insignia, criado en barricas de roble francés, con intensas notas de frutos negros, cuerpo robusto y taninos redondos, ideal para maridar con abundantes carnes.',
    price: 780,
    category: 'vinos',
    subcategory: 'Vinos Uruguayos',
    image: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?q=80&w=600&auto=format&fit=crop',
    ingredients: [{ name: 'Selección Privada', icon: '🍇' }],
    modifiers: [],
    featured: false,
    isSpicy: false,
    isGlutenFree: true,
    isVegetarian: true
  },

  // --- OTROS ---
  {
    id: 'otros-salsa-alioli-pote',
    name: 'Pote de Salsas Especiales',
    description: 'Pote extra de 60ml de aderezo gourmet preparado artesanalmente para saborear tus bastones u orillas de pizza.',
    price: 80,
    category: 'otros',
    subcategory: 'Aderezos',
    image: 'https://images.unsplash.com/photo-1470324161839-ce2bb6fa6bc3?q=80&w=600&auto=format&fit=crop',
    ingredients: [{ name: 'Aderezo Casero', icon: '🧄' }],
    modifiers: [
      { id: 'sel-alioli', name: 'Alioli Casero', price: 0, type: 'removal' },
      { id: 'sel-brava', name: 'Salsa Brava Fuerte', price: 0, type: 'removal' },
      { id: 'sel-barbacoa', name: 'Barbacoa Ahumada', price: 0, type: 'removal' }
    ],
    featured: false,
    isSpicy: false,
    isGlutenFree: true,
    isVegetarian: true
  }
];

export const BUSINESS_COORDINATES = {
  phone: '59898761276',
  instagram: '@bulet.pizza',
  address: 'Plácido Ellauri 3358, La Mondiola',
  hours: 'Martes a Domingo de 19:30 a 23:30 hs'
};
