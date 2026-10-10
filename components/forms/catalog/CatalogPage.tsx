'use client';

import { useEffect, useState, useMemo } from 'react';
import type { ProductForUserDto } from '@/types/product';
import ProductCard from './ProductCard';
import s from './CatalogPage.module.css';

export default function CatalogPage() {
  const [products, setProducts] = useState<ProductForUserDto[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<ProductForUserDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  // Состояния для фильтров
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [sortBy, setSortBy] = useState<'price_asc' | 'price_desc' | 'name'>('name');

  // Состояния для пагинации
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 12;

  // Маппинг категорий на русские названия
  const categoryLabels: Record<string, string> = {
    'SOFA': 'Диваны',
    'ARMCHAIR': 'Кресла',
    'PUFF': 'Пуфы',
    'BED': 'Кровати',
    'TABLE': 'Столы',
    'CHAIR': 'Стулья',
    'OTHER': 'Прочее',
  };

  useEffect(() => {
    const ac = new AbortController();

    (async () => {
      try {
        const res = await fetch('/api/v1/products', {
          cache: 'no-store',
          next: { revalidate: 0 },
          signal: ac.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as ProductForUserDto[];
        const filteredData = (Array.isArray(data) ? data : []).filter(
          (p) => Array.isArray(p.variants) && p.variants.length > 0
        );
        setProducts(filteredData);
        setFilteredProducts(filteredData);
      } catch (e: any) {
        if (e.name !== 'AbortError') setErr(e?.message ?? 'Ошибка загрузки');
      } finally {
        setLoading(false);
      }
    })();

    return () => ac.abort();
  }, []);

  // Извлечение уникальных категорий и сортировка по русским названиям
  const categories = useMemo(() => {
    const cats = products.map(p => p.category).filter((cat): cat is string => !!cat);
    const uniqueCats = Array.from(new Set(cats));
    
    // Сортируем по русским названиям
    return uniqueCats.sort((a, b) => {
      const labelA = categoryLabels[a] || a;
      const labelB = categoryLabels[b] || b;
      return labelA.localeCompare(labelB);
    });
  }, [products]);

  // Фильтрация и сортировка
  useEffect(() => {
    let result = [...products];

    // Поиск по названию
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(term) ||
        p.description?.toLowerCase().includes(term)
      );
    }

    // Фильтрация по категории
    if (selectedCategory) {
      result = result.filter(p => p.category === selectedCategory);
    }

    // Сортировка
    result.sort((a, b) => {
      switch (sortBy) {
        case 'price_asc':
          const priceA = Math.min(...a.variants.map(v => v.price));
          const priceB = Math.min(...b.variants.map(v => v.price));
          return priceA - priceB;
        case 'price_desc':
          const priceA_desc = Math.min(...a.variants.map(v => v.price));
          const priceB_desc = Math.min(...b.variants.map(v => v.price));
          return priceB_desc - priceA_desc;
        case 'name':
        default:
          return a.name.localeCompare(b.name);
      }
    });

    setFilteredProducts(result);
    setCurrentPage(1); // Сброс на первую страницу при изменении фильтров
  }, [products, searchTerm, selectedCategory, sortBy]);

  // Пагинация
  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

  // Обработчики
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedCategory(e.target.value);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as 'price_asc' | 'price_desc' | 'name');
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  if (loading) return <p className={s.muted}>Загрузка каталога…</p>;
  if (err) return <p className={s.muted}>Не удалось загрузить товары: {err}</p>;
  if (products.length === 0) return <p className={s.muted}>Пока нет товаров</p>;

  return (
    <section className={s.wrapper}>
      <h2 className={s.title}>Каталог товаров</h2>

      {/* Панель фильтров */}
      <div className={s.filters}>
        <div className={s.filterGroup}>
          <input
            type="text"
            placeholder="Поиск по названию..."
            value={searchTerm}
            onChange={handleSearchChange}
            className={s.searchInput}
          />
        </div>

        <div className={s.filterGroup}>
          <select
            value={selectedCategory}
            onChange={handleCategoryChange}
            className={s.select}
          >
            <option value="">Все категории</option>
            {categories.map(category => (
              <option key={category} value={category}>
                {categoryLabels[category] || category}
              </option>
            ))}
          </select>
        </div>

        <div className={s.filterGroup}>
          <select
            value={sortBy}
            onChange={handleSortChange}
            className={s.select}
          >
            <option value="name">По названию</option>
            <option value="price_asc">По цене (возрастание)</option>
            <option value="price_desc">По цене (убывание)</option>
          </select>
        </div>
      </div>

      {/* Сетка товаров */}
      {currentProducts.length === 0 ? (
        <div className={s.noResults}>
          <p>Товары не найдены</p>
          <p style={{ fontSize: '14px', marginTop: '8px' }}>
            Попробуйте изменить параметры поиска
          </p>
        </div>
      ) : (
        <>
          <div className={s.grid}>
            {currentProducts.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>

          {/* Пагинация */}
          {totalPages > 1 && (
            <div className={s.pagination}>
              <button
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className={s.pageButton}
              >
                Назад
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <button
                    key={pageNum}
                    onClick={() => handlePageChange(pageNum)}
                    className={`${s.pageButton} ${currentPage === pageNum ? s.active : ''}`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              <button
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className={s.pageButton}
              >
                Вперед
              </button>

              <span className={s.pageInfo}>
                Страница {currentPage} из {totalPages}
              </span>
            </div>
          )}
        </>
      )}
    </section>
  );
}