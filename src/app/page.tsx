import Image from "next/image";
import Link from "next/link";
import { listProducts, listCategories } from "@/modules/catalog/service";
import { parseFilters } from "@/modules/catalog/validation";
import { ProductCard } from "@/components/catalog/product-card";
import { CategoryIcon } from "@/components/catalog/category-icon";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [categories, products] = await Promise.all([
    listCategories(),
    listProducts(parseFilters(new URLSearchParams("pageSize=6"))),
  ]);
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <Image
          src="/images/hero/road.webp"
          alt="Un auto recorre un camino entre árboles"
          width={1600}
          height={900}
          preload
          sizes="100vw"
          className="hero-image"
        />
        <div className="hero-shade" />
        <div className="container hero-content">
          <p className="eyebrow">
            <span /> HECHO PARA SEGUIR EN MOVIMIENTO
          </p>
          <h1 id="hero-title">
            Equipa tu auto.
            <br />
            Disfruta <em>el camino.</em>
          </h1>
          <p className="hero-description">
            Accesorios para cuidar, renovar y sacar lo mejor de cada kilómetro.
            Encuentra el próximo detalle para tu auto.
          </p>
          <Link href="/catalogo" className="button button-red">
            Explorar accesorios <span aria-hidden="true">↗</span>
          </Link>
          <div className="hero-caption">TU AUTO. TU ESTILO. TU CAMINO.</div>
        </div>
        <span className="hero-index" aria-hidden="true">
          01 — ACCESORIOS ESENCIALES
        </span>
      </section>
      <div className="value-strip">
        <div className="container">
          <span>
            <b>01</b> Seis categorías para explorar
          </span>
          <span>
            <b>02</b> Detalles que hacen la diferencia
          </span>
          <span>
            <b>03</b> Precios en pesos chilenos
          </span>
        </div>
      </div>
      <section className="container section" aria-labelledby="category-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow red">ENCUENTRA LO QUE BUSCAS</p>
            <h2 id="category-title">Todo para tu auto.</h2>
          </div>
          <span className="muted">Elige tu próxima mejora.</span>
        </div>
        <div className="category-grid">
          {categories.map((c) => (
            <Link
              key={c.id}
              href={`/catalogo?category=${c.slug}`}
              className="category-card"
            >
              <CategoryIcon slug={c.slug} />
              <h3>{c.name}</h3>
              <span>
                {c.productCount} accesorios <span aria-hidden="true">↗</span>
              </span>
            </Link>
          ))}
        </div>
      </section>
      <section
        className="container section featured-section"
        aria-labelledby="featured-title"
      >
        <div className="section-heading">
          <div>
            <p className="eyebrow red">INSPIRACIÓN PARA TU PRÓXIMA RUTA</p>
            <h2 id="featured-title">Detalles que suman.</h2>
          </div>
          <Link className="text-link" href="/catalogo">
            Ver todo el catálogo <span aria-hidden="true">↗</span>
          </Link>
        </div>
        {products.data.length ? (
          <div className="product-grid featured-grid">
            {products.data.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        ) : (
          <p className="empty-state">
            Estamos preparando los accesorios. Vuelve pronto.
          </p>
        )}
      </section>
      <section className="container">
        <div className="editorial-banner">
          <p className="eyebrow">EL CAMINO EMPIEZA EN LOS DETALLES</p>
          <h2>
            Más cuidado.
            <br />
            Más kilómetros por descubrir.
          </h2>
          <Link
            href="/catalogo?category=limpieza"
            className="button button-white"
          >
            Descubrir cuidado automotriz <span aria-hidden="true">↗</span>
          </Link>
          <span className="editorial-number" aria-hidden="true">
            AP/
          </span>
        </div>
      </section>
    </>
  );
}
