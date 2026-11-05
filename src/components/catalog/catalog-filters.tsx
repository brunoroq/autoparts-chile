"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import type { CatalogCategory } from "@/modules/catalog/service";
import type { CatalogFilters } from "@/modules/catalog/validation";

export function CatalogFiltersForm({
  filters,
  categories,
}: {
  filters: CatalogFilters;
  categories: CatalogCategory[];
}) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    if (detailsRef.current)
      detailsRef.current.open = window.matchMedia("(min-width: 761px)").matches;
  }, []);
  return (
    <details ref={detailsRef} className="filters" open>
      <summary>
        Filtrar accesorios <span aria-hidden="true">＋</span>
      </summary>
      <form action="/catalogo">
        <div className="filter-group">
          <label htmlFor="catalog-q">Buscar producto</label>
          <input
            id="catalog-q"
            type="search"
            name="q"
            defaultValue={filters.q}
            maxLength={100}
            placeholder="Nombre, descripción o SKU"
          />
        </div>
        <fieldset className="filter-group">
          <legend>Categoría</legend>
          <label className="radio-label">
            <input
              type="radio"
              name="category"
              value=""
              defaultChecked={!filters.category}
            />
            Todas las categorías
          </label>
          {categories.map((c) => (
            <label className="radio-label" key={c.id}>
              <input
                type="radio"
                name="category"
                value={c.slug}
                defaultChecked={filters.category === c.slug}
              />
              {c.name}
              <span>{c.productCount}</span>
            </label>
          ))}
        </fieldset>
        <fieldset className="filter-group">
          <legend>Precio en CLP</legend>
          <div className="price-inputs">
            <div>
              <label htmlFor="minPrice">Desde</label>
              <input
                id="minPrice"
                name="minPrice"
                inputMode="numeric"
                type="number"
                min="0"
                max="2147483647"
                defaultValue={filters.minPrice}
                placeholder="0"
              />
            </div>
            <div>
              <label htmlFor="maxPrice">Hasta</label>
              <input
                id="maxPrice"
                name="maxPrice"
                inputMode="numeric"
                type="number"
                min="0"
                max="2147483647"
                defaultValue={filters.maxPrice}
                placeholder="Sin límite"
              />
            </div>
          </div>
        </fieldset>
        <div className="filter-group">
          <label htmlFor="sort">Ordenar por</label>
          <select id="sort" name="sort" defaultValue={filters.sort}>
            <option value="name_asc">Nombre: A a Z</option>
            <option value="price_asc">Menor precio</option>
            <option value="price_desc">Mayor precio</option>
          </select>
        </div>
        <input type="hidden" name="pageSize" value={filters.pageSize} />
        <button className="button button-red" type="submit">
          Aplicar filtros <span aria-hidden="true">→</span>
        </button>
        <Link href="/catalogo" className="reset-filters">
          Limpiar filtros
        </Link>
      </form>
    </details>
  );
}
