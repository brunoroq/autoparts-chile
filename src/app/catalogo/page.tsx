import type { Metadata } from "next";
import Link from "next/link";
import { listCategories, listProducts } from "@/modules/catalog/service";
import {
  parseFilters,
  paramsFromRecord,
  CatalogError,
} from "@/modules/catalog/validation";
import { ProductCard } from "@/components/catalog/product-card";
import { CatalogFiltersForm } from "@/components/catalog/catalog-filters";
import { Pagination } from "@/components/catalog/pagination";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Catálogo" };

export default async function CatalogPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  let filters;
  try {
    filters = parseFilters(paramsFromRecord(await searchParams));
  } catch (error) {
    if (!(error instanceof CatalogError)) throw error;
    return (
      <section className="container section empty-state">
        <h1>Revisa los filtros</h1>
        <p>{error.message}</p>
        <Link className="button button-red" href="/catalogo">
          Volver al catálogo
        </Link>
      </section>
    );
  }
  const [categories, products] = await Promise.all([
    listCategories(),
    listProducts(filters),
  ]);
  const category = categories.find((c) => c.slug === filters.category);
  return (
    <div className="container catalog-page">
      <nav className="breadcrumbs" aria-label="Ruta de navegación">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">/</span>
        <span>Catálogo</span>
      </nav>
      <div className="catalog-heading">
        <p className="eyebrow red">EQUIPA CADA KILÓMETRO</p>
        <h1>
          {category?.name ?? "Todos los accesorios"}
          <span className="red">.</span>
        </h1>
        <p>Encuentra ese detalle que tu auto necesita.</p>
      </div>
      <div className="catalog-layout">
        <aside aria-label="Filtros del catálogo">
          <CatalogFiltersForm
            key={JSON.stringify(filters)}
            filters={filters}
            categories={categories}
          />
        </aside>
        <section aria-label="Productos">
          <div className="results-bar">
            <p>
              <strong>{products.meta.total}</strong> accesorios encontrados
              {filters.q ? ` para “${filters.q}”` : ""}
            </p>
            <span>Precios en CLP</span>
          </div>
          {products.data.length ? (
            <div className="product-grid catalog-grid">
              {products.data.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          ) : (
            <div className="empty-state">
              <h2>No encontramos accesorios</h2>
              <p>
                Prueba otra búsqueda, ajusta el rango de precios o vuelve a la
                primera página.
              </p>
              <Link className="text-link" href="/catalogo">
                Limpiar filtros →
              </Link>
            </div>
          )}
          <Pagination filters={filters} totalPages={products.meta.totalPages} />
        </section>
      </div>
    </div>
  );
}
