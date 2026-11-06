"use client";
import { useAnalytics } from "@/components/analytics/analytics-provider";
import { useState } from "react";
import Link from "next/link";
import { changeGuest, mergeGuestCart } from "@/lib/cart/guest-client";
import { commerce } from "@/lib/analytics/contracts";

export function AddToCart({
  productId,
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
              const cart = await changeGuest(productId, "add", quantity);
              const item = cart.items.find(i => i.productId === productId)!;
              track("add_to_cart", commerce([{ productId, unitPriceClp: item.unitPriceClp, quantity }]), crypto.randomUUID());
              setAdded(true);
              setMessage("Accesorio agregado a tu carrito.");
              return;
            }
            await mergeGuestCart();
            const fresh = await fetch("/api/v1/cart", { cache: "no-store" });
            const state = await fresh.json();
            if (!fresh.ok) {
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
          } catch (error) {
            setMessage(error instanceof Error ? error.message : "No pudimos conectar. Intenta nuevamente.");
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
