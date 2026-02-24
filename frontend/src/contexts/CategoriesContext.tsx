import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import type { CategoryDef } from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '';

interface CategoriesContextValue {
  categories: CategoryDef[];
  labelOf: (id: string) => string;
  iconOf: (id: string) => string;
  isMeal: (id: string) => boolean;
  loading: boolean;
}

const CategoriesContext = createContext<CategoriesContextValue>({
  categories: [],
  labelOf: (id) => id,
  iconOf: () => '📋',
  isMeal: () => false,
  loading: true,
});

export const CategoriesProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<CategoryDef[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get<{ categories: CategoryDef[] }>(`${API_BASE}/api/categories`)
      .then((res) => setCategories(res.data.categories))
      .catch(() => {
        // 네트워크 오류 시 빈 배열 유지 — 각 페이지에서 폴백 처리
      })
      .finally(() => setLoading(false));
  }, []);

  const labelOf = (id: string) => categories.find((c) => c.id === id)?.label ?? id;
  const iconOf = (id: string) => categories.find((c) => c.id === id)?.icon ?? '📋';
  const isMeal = (id: string) => categories.find((c) => c.id === id)?.is_meal ?? false;

  return (
    <CategoriesContext.Provider value={{ categories, labelOf, iconOf, isMeal, loading }}>
      {children}
    </CategoriesContext.Provider>
  );
};

export const useCategories = () => useContext(CategoriesContext);
