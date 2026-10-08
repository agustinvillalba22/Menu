import React, { useState } from 'react';
import {
  Category,
  SubCategory,
  Product,
} from '../../types';
import {
  Plus,
  Flame,
  WheatOff,
  Leaf,
  Sparkles,
  Edit2,
  Trash2,
  Image as ImageIcon,
  Check,
  Search,
  Filter,
  DollarSign,
  Tag
} from 'lucide-react';
import { ConfirmModal } from '../ConfirmModal';

interface MenuManagerProps {
  categories: Category[];
  subCategories: SubCategory[];
  products: Product[];
  onAddCategory: (cat: Omit<Category, 'id' | 'order'>) => void;
  onAddSubCategory: (sub: Omit<SubCategory, 'id'>) => void;
  onSaveProduct: (prod: Product) => void;
  onDeleteProduct: (prodId: string) => void;
}

export const MenuManager: React.FC<MenuManagerProps> = ({
  categories,
  subCategories,
  products,
  onAddCategory,
  onAddSubCategory,
  onSaveProduct,
  onDeleteProduct,
}) => {
  const [selectedCatId, setSelectedCatId] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isEditingProduct, setIsEditingProduct] = useState<Product | null>(null);
  const [isCreatingProduct, setIsCreatingProduct] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);

  // New Category Form
  const [newCatName, setNewCatName] = useState('');
  const [newCatType, setNewCatType] = useState<Category['type']>('Comida');

  // New SubCategory Form
  const [newSubName, setNewSubName] = useState('');
  const [newSubParentCatId, setNewSubParentCatId] = useState(
    categories[0]?.id || ''
  );

  // Featured Card Quick Setup state
  const [selectedFeaturedProduct, setSelectedFeaturedProduct] = useState<Product | null>(
    products.find((p) => p.isFeatured) || null
  );
  const [featuredTitleInput, setFeaturedTitleInput] = useState(
    selectedFeaturedProduct?.featuredTitle || 'Plato Recomendado de la Casa'
  );
  const [featuredDiscountInput, setFeaturedDiscountInput] = useState<number>(
    selectedFeaturedProduct?.featuredDiscount || 15
  );
  const [featuredSavedNotice, setFeaturedSavedNotice] = useState(false);

  // Product Form Modal state
  const [prodForm, setProdForm] = useState<Partial<Product>>({
    name: '',
    description: '',
    price: 0,
    categoryId: categories[0]?.id || '',
    subCategoryId: '',
    imageUrl: '',
    isSpicy: false,
    isGlutenFree: false,
    isVegetarian: false,
    isFeatured: false,
    available: true,
  });

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim()) return;
    onAddCategory({
      name: newCatName.trim(),
      type: newCatType,
    });
    setNewCatName('');
  };

  const handleAddSubCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSubName.trim() || !newSubParentCatId) return;
    onAddSubCategory({
      name: newSubName.trim(),
      categoryId: newSubParentCatId,
    });
    setNewSubName('');
  };

  const openCreateModal = () => {
    setProdForm({
      name: '',
      description: '',
      price: 0,
      categoryId: selectedCatId !== 'all' ? selectedCatId : categories[0]?.id || '',
      subCategoryId: '',
      imageUrl: 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      isSpicy: false,
      isGlutenFree: false,
      isVegetarian: false,
      isFeatured: false,
      available: true,
    });
    setIsCreatingProduct(true);
    setIsEditingProduct(null);
  };

  const openEditModal = (p: Product) => {
    setProdForm({ ...p });
    setIsEditingProduct(p);
    setIsCreatingProduct(false);
  };

  const handleSaveProductModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodForm.name || !prodForm.categoryId) return;

    const finalProduct: Product = {
      id: isEditingProduct ? isEditingProduct.id : `prod-${Date.now()}`,
      name: prodForm.name,
      description: prodForm.description || '',
      price: Number(prodForm.price) || 0,
      categoryId: prodForm.categoryId,
      subCategoryId: prodForm.subCategoryId || undefined,
      imageUrl: prodForm.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80',
      isSpicy: !!prodForm.isSpicy,
      isGlutenFree: !!prodForm.isGlutenFree,
      isVegetarian: !!prodForm.isVegetarian,
      isFeatured: !!prodForm.isFeatured,
      featuredTitle: prodForm.featuredTitle,
      featuredDiscount: prodForm.featuredDiscount,
      available: prodForm.available !== undefined ? prodForm.available : true,
    };

    onSaveProduct(finalProduct);
    setIsCreatingProduct(false);
    setIsEditingProduct(null);
  };

  const handleUpdateFeaturedCard = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFeaturedProduct) return;
    const updated: Product = {
      ...selectedFeaturedProduct,
      isFeatured: true,
      featuredTitle: featuredTitleInput,
      featuredDiscount: Number(featuredDiscountInput) || 0,
    };
    onSaveProduct(updated);
    setFeaturedSavedNotice(true);
    setTimeout(() => setFeaturedSavedNotice(false), 2000);
  };

  const filteredProducts = products.filter((p) => {
    const matchCat = selectedCatId === 'all' || p.categoryId === selectedCatId;
    const matchSearch =
      searchQuery.trim() === '' ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-150">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 border-b border-neutral-200">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 tracking-tight">
            Gestión Integral del Menú
          </h2>
          <p className="text-xs text-neutral-500 mt-0.5">
            Organiza categorías, subcategorías, platos, precios y cards destacadas con descuentos.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors shadow-xs self-start sm:self-auto"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo Producto</span>
        </button>
      </div>

      {/* Featured Card Promotion Studio Section */}
      <div className="bg-white rounded-xl border border-neutral-200 p-5 shadow-xs">
        <div className="flex items-center gap-2 pb-3 border-b border-neutral-100 text-xs font-semibold text-neutral-900">
          <Sparkles className="w-4 h-4 text-amber-500" />
          <span className="uppercase tracking-wider">
            Configuración de Cards Destacadas & Promociones
          </span>
        </div>
        <p className="text-xs text-neutral-500 mt-2 mb-4">
          Personaliza los platos que aparecen en la parte superior del menú digital con título promocional, descuento y precio especial.
        </p>

        <form onSubmit={handleUpdateFeaturedCard} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-[11px] font-medium text-neutral-700 mb-1">
              Plato a Destacar
            </label>
            <select
              value={selectedFeaturedProduct?.id || ''}
              onChange={(e) => {
                const found = products.find((p) => p.id === e.target.value);
                if (found) {
                  setSelectedFeaturedProduct(found);
                  setFeaturedTitleInput(found.featuredTitle || 'Plato Recomendado');
                  setFeaturedDiscountInput(found.featuredDiscount || 10);
                }
              }}
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50/50 focus:bg-white text-neutral-800"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (${p.price.toLocaleString('es-AR')})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-700 mb-1">
              Título Destacado / Badge
            </label>
            <input
              type="text"
              value={featuredTitleInput}
              onChange={(e) => setFeaturedTitleInput(e.target.value)}
              placeholder="Ej: Especial del Chef, 2x1..."
              className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50/50 focus:bg-white text-neutral-800"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-neutral-700 mb-1">
              % Descuento Aplicado
            </label>
            <div className="flex items-center">
              <input
                type="number"
                min="0"
                max="90"
                value={featuredDiscountInput}
                onChange={(e) => setFeaturedDiscountInput(Number(e.target.value))}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50/50 focus:bg-white text-neutral-800 font-mono"
              />
              <span className="ml-2 text-xs text-neutral-500 font-mono">%</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-neutral-900 hover:bg-neutral-800 rounded-lg transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              <span>Aplicar a Card</span>
            </button>
            {featuredSavedNotice && (
              <span className="text-[11px] text-emerald-600 font-medium whitespace-nowrap">
                ¡Listo!
              </span>
            )}
          </div>
        </form>
      </div>

      {/* Categories & Subcategories Add Bar */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* New Category Box */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200">
          <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-2.5">
            + Nueva Categoría
          </h3>
          <form onSubmit={handleAddCategorySubmit} className="flex gap-2">
            <input
              type="text"
              placeholder="Ej: Entradas, Carnes, Postres..."
              value={newCatName}
              onChange={(e) => setNewCatName(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-800"
            />
            <select
              value={newCatType}
              onChange={(e) => setNewCatType(e.target.value as Category['type'])}
              className="px-2 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800"
            >
              <option value="Comida">Comida</option>
              <option value="Bebida">Bebida</option>
              <option value="Postre">Postre</option>
              <option value="Especial">Especial</option>
            </select>
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg whitespace-nowrap"
            >
              Agregar
            </button>
          </form>
        </div>

        {/* New Subcategory Box */}
        <div className="bg-white p-4 rounded-xl border border-neutral-200">
          <h3 className="text-xs font-semibold text-neutral-900 uppercase tracking-wider mb-2.5">
            + Nueva Subcategoría
          </h3>
          <form onSubmit={handleAddSubCategorySubmit} className="flex gap-2">
            <select
              value={newSubParentCatId}
              onChange={(e) => setNewSubParentCatId(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800"
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Ej: Pastas Rellenas, Vinos Tintos..."
              value={newSubName}
              onChange={(e) => setNewSubName(e.target.value)}
              className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-800"
            />
            <button
              type="submit"
              className="px-3 py-1.5 text-xs font-medium text-white bg-neutral-800 hover:bg-neutral-700 rounded-lg whitespace-nowrap"
            >
              Agregar
            </button>
          </form>
        </div>
      </div>

      {/* Main List Section */}
      <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden">
        {/* Filter bar */}
        <div className="p-4 border-b border-neutral-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setSelectedCatId('all')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                selectedCatId === 'all'
                  ? 'bg-neutral-900 text-white'
                  : 'text-neutral-600 hover:bg-neutral-100'
              }`}
            >
              Todos ({products.length})
            </button>
            {categories.map((cat) => {
              const count = products.filter((p) => p.categoryId === cat.id).length;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setSelectedCatId(cat.id)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors ${
                    selectedCatId === cat.id
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-600 hover:bg-neutral-100'
                  }`}
                >
                  {cat.name} ({count})
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar plato o ingrediente..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-800 focus:outline-hidden"
            />
          </div>
        </div>

        {/* Product Grid / Table */}
        <div className="divide-y divide-neutral-100">
          {filteredProducts.map((p) => {
            const cat = categories.find((c) => c.id === p.categoryId);
            const sub = subCategories.find((s) => s.id === p.subCategoryId);

            return (
              <div
                key={p.id}
                className="p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:bg-neutral-50/70 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={p.imageUrl}
                    alt={p.name}
                    referrerPolicy="no-referrer"
                    className="w-14 h-14 rounded-lg object-cover bg-neutral-100 shrink-0 border border-neutral-200"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-semibold text-neutral-900 truncate">
                        {p.name}
                      </h4>
                      {p.isFeatured && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200 font-medium">
                          Destacado ({p.featuredDiscount}% OFF)
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 line-clamp-1 max-w-xl mt-0.5">
                      {p.description}
                    </p>

                    {/* Metadata tags */}
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-neutral-400">
                      <span className="text-neutral-600 font-medium">
                        {cat?.name || 'General'}
                        {sub && ` · ${sub.name}`}
                      </span>
                      {p.isSpicy && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-red-600 flex items-center gap-0.5">
                            <Flame className="w-2.5 h-2.5" /> Picante
                          </span>
                        </>
                      )}
                      {p.isGlutenFree && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-amber-600 flex items-center gap-0.5">
                            <WheatOff className="w-2.5 h-2.5" /> Sin TACC
                          </span>
                        </>
                      )}
                      {p.isVegetarian && (
                        <>
                          <span aria-hidden="true">·</span>
                          <span className="text-emerald-600 flex items-center gap-0.5">
                            <Leaf className="w-2.5 h-2.5" /> Veggie
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                  <span className="font-mono text-xs font-semibold text-neutral-900 tabular-nums">
                    ${p.price.toLocaleString('es-AR')}
                  </span>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEditModal(p)}
                      className="p-1.5 text-neutral-500 hover:text-neutral-800 hover:bg-neutral-200/60 rounded-md transition-colors"
                      title="Editar plato"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setProductToDelete(p)}
                      className="p-1.5 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                      title="Eliminar plato"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="p-8 text-center text-xs text-neutral-400">
              No se encontraron productos en esta selección.
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit Product Modal */}
      {(isCreatingProduct || isEditingProduct) && (
        <div className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl border border-neutral-200 w-full max-w-lg overflow-hidden animate-in fade-in duration-150">
            <div className="px-5 py-3.5 border-b border-neutral-100 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">
                {isEditingProduct ? 'Editar Producto' : 'Crear Nuevo Producto'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingProduct(false);
                  setIsEditingProduct(null);
                }}
                className="text-xs text-neutral-400 hover:text-neutral-600"
              >
                Cerrar
              </button>
            </div>

            <form onSubmit={handleSaveProductModal} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Nombre del Plato / Bebida
                </label>
                <input
                  type="text"
                  required
                  value={prodForm.name}
                  onChange={(e) =>
                    setProdForm({ ...prodForm, name: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Descripción e Ingredientes
                </label>
                <textarea
                  rows={2}
                  value={prodForm.description}
                  onChange={(e) =>
                    setProdForm({ ...prodForm, description: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Precio ($)
                  </label>
                  <input
                    type="number"
                    required
                    value={prodForm.price}
                    onChange={(e) =>
                      setProdForm({ ...prodForm, price: Number(e.target.value) })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-900 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-neutral-700 mb-1">
                    Categoría
                  </label>
                  <select
                    value={prodForm.categoryId}
                    onChange={(e) =>
                      setProdForm({ ...prodForm, categoryId: e.target.value })
                    }
                    className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Subcategoría (Opcional)
                </label>
                <select
                  value={prodForm.subCategoryId || ''}
                  onChange={(e) =>
                    setProdForm({ ...prodForm, subCategoryId: e.target.value })
                  }
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-800"
                >
                  <option value="">Sin subcategoría</option>
                  {subCategories
                    .filter((s) => s.categoryId === prodForm.categoryId)
                    .map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  URL de Imagen del Plato
                </label>
                <input
                  type="text"
                  value={prodForm.imageUrl}
                  onChange={(e) =>
                    setProdForm({ ...prodForm, imageUrl: e.target.value })
                  }
                  placeholder="https://..."
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-neutral-200 bg-neutral-50 focus:bg-white text-neutral-800"
                />
              </div>

              {/* Special dietary tags */}
              <div className="pt-2 border-t border-neutral-100">
                <label className="block text-[11px] font-medium text-neutral-600 mb-2">
                  Atributos alimentarios (Tags de accesibilidad para el comensal)
                </label>
                <div className="flex items-center gap-4 text-xs">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodForm.isSpicy}
                      onChange={(e) =>
                        setProdForm({ ...prodForm, isSpicy: e.target.checked })
                      }
                      className="rounded border-neutral-300 text-neutral-900"
                    />
                    <span className="flex items-center gap-1 text-red-700">
                      <Flame className="w-3.5 h-3.5" /> Picante
                    </span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodForm.isGlutenFree}
                      onChange={(e) =>
                        setProdForm({
                          ...prodForm,
                          isGlutenFree: e.target.checked,
                        })
                      }
                      className="rounded border-neutral-300 text-neutral-900"
                    />
                    <span className="flex items-center gap-1 text-amber-700">
                      <WheatOff className="w-3.5 h-3.5" /> Sin TACC
                    </span>
                  </label>

                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={prodForm.isVegetarian}
                      onChange={(e) =>
                        setProdForm({
                          ...prodForm,
                          isVegetarian: e.target.checked,
                        })
                      }
                      className="rounded border-neutral-300 text-neutral-900"
                    />
                    <span className="flex items-center gap-1 text-emerald-700">
                      <Leaf className="w-3.5 h-3.5" /> Vegetariano
                    </span>
                  </label>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingProduct(false);
                    setIsEditingProduct(null);
                  }}
                  className="px-3 py-1.5 text-xs text-neutral-600 hover:bg-neutral-100 rounded-md"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-medium text-white bg-neutral-900 rounded-md hover:bg-neutral-800"
                >
                  Guardar Plato
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal before deleting product */}
      <ConfirmModal
        isOpen={!!productToDelete}
        title="¿Estás seguro que quieres eliminar?"
        itemName={productToDelete?.name}
        description="Este plato será eliminado definitivamente de la carta y no estará disponible para comensales ni comandas."
        confirmText="Sí, eliminar plato"
        cancelText="Cancelar"
        onConfirm={() => {
          if (productToDelete) {
            onDeleteProduct(productToDelete.id);
            setProductToDelete(null);
          }
        }}
        onCancel={() => setProductToDelete(null)}
      />
    </div>
  );
};
