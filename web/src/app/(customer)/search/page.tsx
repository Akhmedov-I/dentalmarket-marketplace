'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api-client';
import { 
  Filter, 
  SlidersHorizontal, 
  Star, 
  CheckCircle, 
  AlertCircle,
  RotateCcw,
  ShoppingCart
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useCartStore } from '@/lib/store';

interface Product {
  id: string;
  title: string;
  brand: string;
  price: number;
  rating: number;
  certified: boolean;
  inStock: boolean;
  category: string;
  imageColor: string;
}

// Rich fallback mock database if API fails or is loading
const MOCK_PRODUCTS: Product[] = [
  { id: '1', title: 'Стоматологическая установка Ajax AJ15', brand: 'Ajax', price: 85000000, rating: 4.8, certified: true, inStock: true, category: 'equipment', imageColor: 'from-blue-600 to-indigo-700' },
  { id: '2', title: 'Рентген-аппарат портативный Port-X II', brand: 'Genoray', price: 32000000, rating: 4.9, certified: true, inStock: true, category: 'equipment', imageColor: 'from-indigo-600 to-purple-700' },
  { id: '3', title: 'Автоклав класса B Runyes Feng 23L', brand: 'Runyes', price: 2150000, rating: 4.7, certified: true, inStock: true, category: 'equipment', imageColor: 'from-cyan-600 to-blue-700' },
  { id: '4', title: 'Набор терапевтических инструментов (12 шт)', brand: 'HLW Dental', price: 4200000, rating: 4.5, certified: true, inStock: true, category: 'instruments', imageColor: 'from-teal-600 to-emerald-700' },
  { id: '5', title: 'Пинцет стоматологический изогнутый', brand: 'Medesy', price: 180000, rating: 4.3, certified: false, inStock: true, category: 'instruments', imageColor: 'from-green-600 to-teal-700' },
  { id: '6', title: 'Скейлер ультразвуковой Woodpecker UDS-E', brand: 'Woodpecker', price: 3800000, rating: 4.6, certified: true, inStock: false, category: 'instruments', imageColor: 'from-emerald-600 to-cyan-700' },
  { id: '7', title: 'Композит светового отверждения Filtek Z250', brand: '3M ESPE', price: 650000, rating: 4.9, certified: true, inStock: true, category: 'materials', imageColor: 'from-amber-600 to-orange-700' },
  { id: '8', title: 'Адгезив стоматологический Single Bond 2', brand: '3M ESPE', price: 320000, rating: 4.8, certified: true, inStock: true, category: 'materials', imageColor: 'from-orange-600 to-red-700' },
  { id: '9', title: 'Альгинатная масса Hydrogum 5 (500г)', brand: 'Zhermack', price: 150000, rating: 4.4, certified: false, inStock: true, category: 'materials', imageColor: 'from-pink-600 to-rose-700' },
];

function SearchPageContent() {
  const searchParams = useSearchParams();
  const queryParam = searchParams.get('q') || '';
  const categoryParam = searchParams.get('category') || '';

  // State
  const [searchQuery, setSearchQuery] = useState(queryParam);
  const [selectedCategory, setSelectedCategory] = useState(categoryParam);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [onlyCertified, setOnlyCertified] = useState(false);
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [sortBy, setSortBy] = useState('popular');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const { itemCount, setItemCount } = useCartStore();

  // API query using TanStack Query
  const { data: apiProducts, isLoading } = useQuery<Product[]>({
    queryKey: ['products', queryParam, selectedCategory, sortBy],
    queryFn: async () => {
      const path = `/search?q=${encodeURIComponent(queryParam)}&category=${selectedCategory}`;
      try {
        const res = await api.get<any>(path);
        console.log('🔍 Search API response:', JSON.stringify(res));
        if (res && Array.isArray(res.hits)) {
          return res.hits.map((h: any) => ({
            id: h.id,
            title: h.title,
            brand: h.brand || 'Unbranded',
            price: Number(h.base_price) || 0,
            rating: h.rating_avg || 0,
            certified: Array.isArray(h.certification_standards) && h.certification_standards.length > 0,
            inStock: h.in_stock !== false,
            category: h.category_id || '',
            imageColor: 'from-blue-600 to-indigo-700',
          }));
        }
        if (Array.isArray(res)) {
          return res;
        }
        return MOCK_PRODUCTS;
      } catch (err) {
        console.warn('API connection failed. Serving mock data.', err);
        return MOCK_PRODUCTS;
      }
    },
  });

  const handleResetFilters = () => {
    setSelectedCategory('');
    setPriceMin('');
    setPriceMax('');
    setSelectedBrand('');
    setOnlyCertified(false);
    setOnlyInStock(false);
    setSearchQuery('');
  };

  const handleAddToCart = () => {
    setItemCount(itemCount + 1);
  };

  // Client-side filtering as a robust overlay & search execution
  const filteredProducts = (apiProducts || MOCK_PRODUCTS).filter((prod) => {
    // Search keyword match
    if (searchQuery) {
      const matchText = `${prod.title} ${prod.brand}`.toLowerCase();
      if (!matchText.includes(searchQuery.toLowerCase())) return false;
    }
    
    // Category match
    if (selectedCategory && prod.category !== selectedCategory) return false;

    // Brand match
    if (selectedBrand && prod.brand !== selectedBrand) return false;

    // Certification check
    if (onlyCertified && !prod.certified) return false;

    // In stock check
    if (onlyInStock && !prod.inStock) return false;

    // Price checks
    const priceNum = prod.price;
    if (priceMin && priceNum < Number(priceMin)) return false;
    if (priceMax && priceNum > Number(priceMax)) return false;

    return true;
  }).sort((a, b) => {
    if (sortBy === 'price-asc') return a.price - b.price;
    if (sortBy === 'price-desc') return b.price - a.price;
    if (sortBy === 'rating') return b.rating - a.rating;
    return 0; // Default popularity / natural order
  });

  const formatPrice = (value: number) => {
    return new Intl.NumberFormat('ru-UZ', { style: 'currency', currency: 'UZS', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="container mx-auto px-4 py-8 sm:px-6 lg:px-8 flex-grow">
      
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[hsl(var(--text-primary))]">
            Каталог стоматологической продукции
          </h1>
          <p className="text-xs text-[hsl(var(--text-secondary))] mt-1">
            Найдено {filteredProducts.length} позиций
          </p>
        </div>

        {/* Sort & Mobile filter trigger */}
        <div className="flex w-full md:w-auto items-center gap-3 self-stretch md:self-auto justify-between">
          <Button 
            variant="outline" 
            onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
            className="md:hidden flex items-center gap-2"
          >
            <SlidersHorizontal className="h-4 w-4" />
            Фильтры
          </Button>

          <div className="flex items-center gap-2 ml-auto">
            <span className="hidden sm:inline text-xs text-[hsl(var(--text-secondary))] whitespace-nowrap">Сортировка:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="input-field py-1 px-3 text-xs w-[160px]"
            >
              <option value="popular">По популярности</option>
              <option value="price-asc">Сначала дешевле</option>
              <option value="price-desc">Сначала дорогие</option>
              <option value="rating">По рейтингу</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-8 items-start">
        
        {/* Sidebar Filters - Desktop */}
        <aside className={classNameForFilters(mobileFiltersOpen)}>
          <div className="flex items-center justify-between border-b border-[hsl(var(--border-default))] pb-4 mb-4">
            <h3 className="font-bold flex items-center gap-2 text-[hsl(var(--text-primary))]">
              <Filter className="h-4 w-4 text-[hsl(var(--color-primary))]" />
              Параметры подбора
            </h3>
            <button 
              onClick={handleResetFilters}
              className="text-[10px] uppercase font-bold text-[hsl(var(--color-primary))] hover:underline flex items-center gap-1"
            >
              <RotateCcw className="h-3 w-3" />
              Сброс
            </button>
          </div>

          <div className="space-y-6 text-sm">
            {/* Category Select */}
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--text-secondary))] mb-2">Категория</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input-field w-full text-xs"
              >
                <option value="">Все категории</option>
                <option value="equipment">Оборудование</option>
                <option value="instruments">Инструменты</option>
                <option value="materials">Расходные материалы</option>
              </select>
            </div>

            {/* Price Range */}
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--text-secondary))] mb-2">Цена (сум)</label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  placeholder="От"
                  value={priceMin}
                  onChange={(e) => setPriceMin(e.target.value)}
                  className="input-field text-xs py-1.5"
                />
                <input
                  type="number"
                  placeholder="До"
                  value={priceMax}
                  onChange={(e) => setPriceMax(e.target.value)}
                  className="input-field text-xs py-1.5"
                />
              </div>
            </div>

            {/* Brand Select */}
            <div>
              <label className="block text-xs font-semibold text-[hsl(var(--text-secondary))] mb-2">Бренд</label>
              <select
                value={selectedBrand}
                onChange={(e) => setSelectedBrand(e.target.value)}
                className="input-field w-full text-xs"
              >
                <option value="">Все бренды</option>
                <option value="3M ESPE">3M ESPE</option>
                <option value="Ajax">Ajax</option>
                <option value="Genoray">Genoray</option>
                <option value="Medesy">Medesy</option>
                <option value="Woodpecker">Woodpecker</option>
              </select>
            </div>

            {/* Toggles */}
            <div className="space-y-3 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyCertified}
                  onChange={(e) => setOnlyCertified(e.target.checked)}
                  className="rounded border-[hsl(var(--border-default))] text-[hsl(var(--color-primary))] focus:ring-[hsl(var(--color-primary))] h-4 w-4"
                />
                <span className="text-xs text-[hsl(var(--text-primary))]">Только сертифицированные</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyInStock}
                  onChange={(e) => setOnlyInStock(e.target.checked)}
                  className="rounded border-[hsl(var(--border-default))] text-[hsl(var(--color-primary))] focus:ring-[hsl(var(--color-primary))] h-4 w-4"
                />
                <span className="text-xs text-[hsl(var(--text-primary))]">В наличии на складе</span>
              </label>
            </div>
          </div>
          
          <Button 
            className="w-full mt-6 md:hidden bg-gradient-to-r from-[hsl(var(--color-primary))] to-[hsl(var(--color-secondary))] text-white border-0"
            onClick={() => setMobileFiltersOpen(false)}
          >
            Применить
          </Button>
        </aside>

        {/* Product Grid Area */}
        <section className="col-span-1 md:col-span-3">
          
          {isLoading && filteredProducts.length === 0 ? (
            /* Loading Shimmer Skeletons */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="glass-card animate-pulse space-y-4 p-4 h-[380px]">
                  <div className="w-full h-44 rounded-lg bg-[hsl(var(--bg-tertiary))] shimmer"></div>
                  <div className="h-4 w-2/3 bg-[hsl(var(--bg-tertiary))] rounded"></div>
                  <div className="h-6 w-1/3 bg-[hsl(var(--bg-tertiary))] rounded"></div>
                  <div className="h-10 w-full bg-[hsl(var(--bg-tertiary))] rounded mt-4"></div>
                </div>
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center py-20 text-center glass-card">
              <AlertCircle className="h-12 w-12 text-[hsl(var(--text-tertiary))] mb-4" />
              <h3 className="text-lg font-bold text-[hsl(var(--text-primary))] mb-1">Ничего не найдено</h3>
              <p className="text-xs text-[hsl(var(--text-secondary))] max-w-xs mb-6">
                Попробуйте изменить параметры поиска или сбросить фильтры.
              </p>
              <Button onClick={handleResetFilters} variant="outline" size="sm">Сбросить фильтры</Button>
            </div>
          ) : (
            /* Product List Grid */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 stagger-children">
              {filteredProducts.map((product) => (
                <Card key={product.id} className="border border-[hsl(var(--border-default))] overflow-hidden flex flex-col justify-between hover:shadow-lg hover:border-[hsl(var(--color-primary)/0.3)] transition-all duration-300 group">
                  <CardContent className="p-0">
                    
                    {/* Visual Placeholder Graphic */}
                    <div className={`w-full h-44 bg-gradient-to-tr ${product.imageColor} relative flex items-center justify-center p-4 transition-all duration-300 group-hover:brightness-95`}>
                      <span className="text-white/20 font-black tracking-widest text-3xl select-none">DENTAL</span>
                      
                      {/* Certified Badge */}
                      {product.certified && (
                        <span className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500 text-white shadow-sm border border-emerald-400/20">
                          <CheckCircle className="h-3 w-3" />
                          СЕРТИФИЦИРОВАНО
                        </span>
                      )}

                      {/* Stock Badge */}
                      {!product.inStock && (
                        <span className="absolute top-3 right-3 px-2.5 py-0.5 rounded-full text-[9px] font-bold bg-[hsl(var(--bg-tertiary))] text-[hsl(var(--text-secondary))] border border-[hsl(var(--border-default))]">
                          ПОД ЗАКАЗ
                        </span>
                      )}
                    </div>

                    <div className="p-5 space-y-2.5">
                      <div className="flex items-center justify-between text-xs text-[hsl(var(--text-tertiary))]">
                        <span className="font-semibold uppercase tracking-wider">{product.brand}</span>
                        <div className="flex items-center gap-1 text-amber-500 font-bold">
                          <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                          {product.rating}
                        </div>
                      </div>

                      <h3 className="font-bold text-sm text-[hsl(var(--text-primary))] group-hover:text-[hsl(var(--color-primary))] transition-colors line-clamp-2 min-h-[40px]">
                        {product.title}
                      </h3>

                      <div className="pt-2 flex items-baseline justify-between">
                        <div className="text-base font-extrabold text-[hsl(var(--text-primary))]">
                          {formatPrice(product.price)}
                        </div>
                      </div>
                    </div>
                  </CardContent>

                  <div className="p-5 pt-0">
                    <Button 
                      className="w-full flex items-center gap-2 justify-center text-xs" 
                      variant={product.inStock ? "primary" : "outline"}
                      disabled={!product.inStock}
                      onClick={() => handleAddToCart()}
                    >
                      <ShoppingCart className="h-4 w-4" />
                      {product.inStock ? 'В корзину' : 'Заказать'}
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

// Sidebar container responsiveness helper class
function classNameForFilters(mobileOpen: boolean): string {
  return mobileOpen 
    ? "fixed inset-0 z-50 bg-[hsl(var(--bg-elevated))] p-6 flex flex-col md:relative md:inset-auto md:z-auto md:bg-transparent md:p-0 col-span-1 border border-[hsl(var(--border-default))] rounded-2xl md:shadow-none p-5"
    : "hidden md:block col-span-1 border border-[hsl(var(--border-default))] rounded-2xl bg-[hsl(var(--bg-elevated))] p-5 shadow-sm sticky top-20";
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="container mx-auto px-4 py-8 flex-grow flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[hsl(var(--color-primary))] border-t-transparent"></div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  );
}
