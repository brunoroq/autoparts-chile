"use client";
import { useState } from "react";
import Link from "next/link";
import type { CartSnapshot } from "@/modules/cart/service";
import { ProductImage } from "@/components/catalog/product-image";
import { formatClp } from "@/lib/format";

export function CartView({ initialCart }: { initialCart: CartSnapshot }) {
  const [cart, setCart] = useState(initialCart);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  async function change(
    productId: string,
    method: "PATCH" | "DELETE",
    quantity?: number,
  ) {
    setPending(true);
    setMessage("");
    try {
      const response = await fetch(`/api/v1/cart/items/${productId}`, {
        method,
        headers: {
          "Content-Type": "application/json",
          "If-Match": `"${cart.version}"`,
        },
        ...(method === "PATCH" ? { body: JSON.stringify({ quantity }) } : {}),
      });
      const result = await response.json();
      if (response.ok) {
        setCart(result.data);
        setMessage(
          method === "DELETE"
            ? "Accesorio eliminado del carrito."
            : "Cantidad actualizada.",
        );
      } else {
        if (response.status === 409) {
          const fresh = await fetch("/api/v1/cart", { cache: "no-store" });
          if (fresh.ok) setCart((await fresh.json()).data);
        }
        setMessage(result.error?.message ?? "No pudimos modificar el carrito.");
      }
    } catch {
      setMessage("No pudimos conectar. Vuelve a intentar.");
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <div className="catalog-heading">
        <p className="eyebrow red">TUS PRÓXIMOS ACCESORIOS</p>
        <h1>
          Tu carrito<span className="red">.</span>
        </h1>
        <p>Guardado en tu cuenta para cuando vuelvas.</p>
      </div>
      {message && (
        <p role="status" className="form-notice cart-message">
          {message}
        </p>
      )}
      {cart.items.length ? (
        <div className="cart-layout">
          <section aria-label="Productos en tu carrito">
            {cart.items.map((item) => (
              <article
                className="cart-row"
                key={`${item.productId}-${cart.version}`}
              >
                <Link className="cart-image" href={`/productos/${item.slug}`}>
                  <ProductImage src={item.imagePath} alt={item.imageAlt} />
                </Link>
                <div className="cart-item-info">
                  <Link href={`/productos/${item.slug}`}>
                    <h2>{item.name}</h2>
                  </Link>
                  <p>{formatClp(item.unitPriceClp)} por unidad</p>
                  {item.warning && <p className="form-error">{item.warning}</p>}
                  <form
                    onSubmit={(event) => {
                      event.preventDefault();
                      const quantity = Number(
                        new FormData(event.currentTarget).get("quantity"),
                      );
                      void change(item.productId, "PATCH", quantity);
                    }}
                  >
                    <label htmlFor={`quantity-${item.productId}`}>
                      Cantidad
                      <input
                        id={`quantity-${item.productId}`}
                        name="quantity"
                        type="number"
                        min={1}
                        max={Math.min(99, item.availableStock)}
                        defaultValue={item.quantity}
                        required
                        disabled={pending}
                      />
                    </label>
                    <button className="cart-update" disabled={pending}>
                      Actualizar
                    </button>
                    <button
                      type="button"
                      className="cart-remove"
                      onClick={() => void change(item.productId, "DELETE")}
                      disabled={pending}
                      aria-label={`Eliminar ${item.name}`}
                    >
                      Eliminar
                    </button>
                  </form>
                </div>
                <strong className="cart-subtotal">
                  {formatClp(item.subtotalClp)}
                </strong>
              </article>
            ))}
          </section>
          <aside className="cart-summary">
            <h2>Resumen del carrito</h2>
            <p>
              <span>Accesorios</span>
              <span>
                {cart.items.reduce((sum, item) => sum + item.quantity, 0)}
              </span>
            </p>
            <p className="cart-total">
              <span>Total informativo</span>
              <strong>{formatClp(cart.totalClp)}</strong>
            </p>
            <p className="form-help">
              Precios en CLP calculados desde el catálogo actual. El stock no
              está reservado.
            </p>
            <div className="demo-note">
              Tienda de demostración. El checkout y los pagos todavía no están
              habilitados.
            </div>
            <Link href="/catalogo" className="button button-dark">
              Seguir explorando →
            </Link>
          </aside>
        </div>
      ) : (
        <div className="empty-state">
          <h2>Tu carrito está vacío.</h2>
          <p>Encuentra el próximo detalle para tu auto.</p>
          <Link href="/catalogo" className="button button-red">
            Explorar accesorios →
          </Link>
        </div>
      )}
    </>
  );
}
