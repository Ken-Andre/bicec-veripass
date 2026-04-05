/**
 * Hook de pagination générique
 * Source: veripass-gatekeeper prototype (src/hooks/usePagination.ts)
 */

import { useState, useMemo } from 'react';

/**
 * Hook de pagination pour les listes de données
 *
 * @param data - Données à paginer
 * @param pageSize - Nombre d'éléments par page (défaut: 10)
 * @returns Objet Pagination avec page, setPage, pageData, totalPages, totalItems
 */
export function usePagination<T>(data: T[], pageSize = 10) {
  const [page, setPage] = useState(1);

  const totalPages = Math.max(1, Math.ceil(data.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const pageData = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return data.slice(start, start + pageSize);
  }, [data, safePage, pageSize]);

  return {
    page: safePage,
    setPage,
    pageData,
    totalPages,
    totalItems: data.length,
  };
}