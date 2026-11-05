import Link from "next/link";
import { ProductImage } from "./product-image";
import { formatClp } from "@/lib/format";
import type { CatalogProduct } from "@/modules/catalog/service";

export function ProductCard({ product }: { product: CatalogProduct }) {
  return (
    <article className="product-card">
      <Link href={`/productos/${product.slug}`} className="product-link">
        <div className="product-photo">
          <ProductImage src={product.imagePath} alt={product.imageAlt} />
          <span className="product-view" aria-hidden="true">
            ↗
          </span>
        </div>
        <div className="product-info">
          <p className="product-category">{product.category.name}</p>
          <h3>{product.name}</h3>
          <div className="product-price">
            {formatClp(product.priceClp)}
            <span>CLP</span>
          </div>
          <span className="sr-only">Ver detalle</span>
        </div>
      </Link>
    </article>
  );
}
