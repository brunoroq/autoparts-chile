import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { findProduct } from "@/modules/catalog/service";
import { ProductImage } from "@/components/catalog/product-image";
import { formatClp } from "@/lib/format";
import { AddToCart } from "@/components/cart/add-to-cart";

export const dynamic = "force-dynamic";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug.split("-").join(" ").slice(0, 180) };
}
export default async function ProductPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await findProduct(slug, "slug");
  if (!product) notFound();
  return (
    <div className="container detail-page">
      <nav className="breadcrumbs" aria-label="Ruta de navegación">
        <Link href="/">Inicio</Link>
        <span aria-hidden="true">/</span>
        <Link href="/catalogo">Catálogo</Link>
        <span aria-hidden="true">/</span>
        <Link href={`/catalogo?category=${product.category.slug}`}>
          {product.category.name}
        </Link>
      </nav>
      <article className="product-detail">
        <div className="detail-visual">
          <ProductImage src={product.imagePath} alt={product.imageAlt} detail />
          <p>Ilustración referencial · Producto de demostración</p>
        </div>
        <div className="detail-info">
          <p className="eyebrow red">{product.category.name}</p>
          <h1>{product.name}</h1>
          <p className="sku">SKU {product.sku}</p>
          <div className="detail-price">
            {formatClp(product.priceClp)}
            <span>CLP</span>
          </div>
          <p className="stock">
            <span aria-hidden="true">●</span>{" "}
            {product.stock > 0
              ? `Disponible · ${product.stock} unidades de prueba`
              : "Sin stock de prueba"}
          </p>
          <div className="detail-description">
            <h2>Un detalle para tu camino</h2>
            <p>{product.description}</p>
          </div>
          <div className="demo-note">
            Catálogo de demostración. Los precios y existencias son ficticios;
            las compras todavía no están habilitadas.
          </div>
          <AddToCart
            productId={product.id}
            slug={product.slug}
            stock={product.stock}
          />
          <Link
            className="button button-dark"
            href={`/catalogo?category=${product.category.slug}`}
          >
            Explorar {product.category.name.toLowerCase()}{" "}
            <span aria-hidden="true">→</span>
          </Link>
        </div>
      </article>
    </div>
  );
}
