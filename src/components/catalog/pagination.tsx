import Link from "next/link";
import type { CatalogFilters } from "@/modules/catalog/validation";

export function Pagination({
  filters,
  totalPages,
}: {
  filters: CatalogFilters;
  totalPages: number;
}) {
  const href = (page: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...filters, page }))
      if (value !== undefined && value !== "") params.set(key, String(value));
    return `/catalogo?${params}`;
  };
  if (totalPages === 0) return null;
  if (filters.page > totalPages)
    return (
      <nav className="pagination" aria-label="Paginación del catálogo">
        <span>La página solicitada está fuera del catálogo.</span>
        <Link href={href(1)}>Volver a la primera página →</Link>
      </nav>
    );
  return (
    <nav aria-label="Paginación del catálogo" className="pagination">
      {filters.page > 1 ? (
        <Link href={href(filters.page - 1)} rel="prev">
          ← Anterior
        </Link>
      ) : (
        <span />
      )}
      <span aria-live="polite">
        Página {filters.page} de {totalPages}
      </span>
      {filters.page < totalPages ? (
        <Link href={href(filters.page + 1)} rel="next">
          Siguiente →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}
