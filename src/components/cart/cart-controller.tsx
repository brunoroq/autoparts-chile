"use client";
import { useEffect, useState } from "react";
import { CartView } from "./cart-view";
import { readGuestCart } from "@/lib/cart/guest-storage";
import { mergeGuestCart, quoteGuest } from "@/lib/cart/guest-client";
import type { CartSnapshot } from "@/modules/cart/service";

const emptySnapshot: CartSnapshot = {
  version: 0,
  items: [],
  totalClp: 0,
  currency: "CLP",
};

export function CartController({
  initialCart,
}: {
  initialCart: CartSnapshot | null;
}) {
  const [state, setState] = useState<{
    cart: CartSnapshot;
    guest: boolean;
  } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const guestItems = readGuestCart().items;

        if (initialCart) {
          try {
            // Evitar merge si el carrito de invitado está vacío
            const merged =
              guestItems.length > 0 ? await mergeGuestCart() : initialCart;
            if (!cancelled) {
              setState({ cart: merged ?? initialCart, guest: false });
              setError("");
            }
          } catch (failure) {
            // Evitar quoteGuest si cae en el catch y está vacío
            const cart =
              guestItems.length > 0
                ? await quoteGuest(guestItems)
                : emptySnapshot;
            if (!cancelled) {
              setState({ cart, guest: true });
              setError(
                (failure instanceof Error
                  ? failure.message
                  : "No pudimos fusionar el carrito.") +
                  " Tu carrito de cuenta se conserva. Ajusta el carrito de invitado y vuelve a intentar.",
              );
            }
          }
        } else {
          // Interceptar invitado vacío y simular respuesta local
          if (guestItems.length === 0) {
            if (!cancelled) setState({ cart: emptySnapshot, guest: true });
          } else {
            const cart = await quoteGuest(guestItems);
            if (!cancelled) setState({ cart, guest: true });
          }
        }
      } catch (failure) {
        if (!cancelled)
          setError(
            failure instanceof Error
              ? failure.message
              : "No pudimos leer el carrito guardado.",
          );
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [initialCart, attempt]);

  // Pantalla de estado vacío
  if (state && state.cart.items.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "4rem 2rem" }}>
        <p style={{ fontSize: "1.125rem", color: "#4b5563" }}>
          aún no has añadido nada al carrito
        </p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div role="alert" className="form-error">
          <p>{error}</p>
          <button
            className="button button-dark"
            onClick={() => setAttempt((a) => a + 1)}
          >
            Volver a intentar
          </button>
        </div>
      )}
      {state ? (
        <CartView
          key={`${attempt}-${state.guest}`}
          initialCart={state.cart}
          guest={state.guest}
        />
      ) : (
        <p role="status">Consultando tu carrito…</p>
      )}
    </>
  );
}
