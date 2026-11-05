"use client";
import { useAnalytics } from "@/components/analytics/analytics-provider";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AddToCart({
  productId,
  slug,
  stock,
}: {
  productId: string;
  slug: string;
  stock: number;
}) {
  const [quantity, setQuantity] = useState(1);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [added, setAdded] = useState(false);
  const router = useRouter();
  const { track } = useAnalytics();
  return (
    <div className="add-cart">
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          setPending(true);
          setMessage("");
          setAdded(false);
          try {
            const current = await fetch("/api/v1/cart", { cache: "no-store" });
            if (current.status === 401) {
              router.push(
                `/iniciar-sesion?callbackUrl=${encodeURIComponent(`/productos/${slug}`)}`,
              );
              return;
            }
            const state = await current.json();
            if (!current.ok) {
              setMessage(
                state.error?.message ?? "No pudimos consultar el carrito.",
              );
              return;
            }
            const response = await fetch("/api/v1/cart/items", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "If-Match": `"${state.data.version}"`,
              },
              body: JSON.stringify({ productId, quantity }),
            });
            const result = await response.json();
            if (!response.ok) {
              setMessage(
                result.error?.message ?? "No pudimos agregar el accesorio.",
              );
              return;
            }
            if (result.analytics)
              track(
                "add_to_cart",
                result.analytics.value,
                result.analytics.eventId,
              );
            setAdded(true);
            setMessage("Accesorio agregado a tu carrito.");
          } catch {
            setMessage("No pudimos conectar. Intenta nuevamente.");
          } finally {
            setPending(false);
          }
        }}
      >
        <label htmlFor="add-quantity">
          Cantidad
          <input
            id="add-quantity"
            type="number"
            min={1}
            max={Math.min(99, stock)}
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
            required
            disabled={stock === 0 || pending}
          />
        </label>
        <button className="button button-red" disabled={pending || stock === 0}>
          {pending
            ? "Agregando…"
            : stock === 0
              ? "Sin stock"
              : "Agregar al carrito"}
          <span aria-hidden="true">＋</span>
        </button>
      </form>
      {message && (
        <p role="status" className={added ? "form-notice" : "form-error"}>
          {message} {added && <Link href="/carrito">Ver carrito →</Link>}
        </p>
      )}
      <p className="form-help">
        Los productos en el carrito no reservan stock.
      </p>
    </div>
  );
}
