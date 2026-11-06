"use client";
import { useEffect, useState } from "react";
import { CartView } from "./cart-view";
import { readGuestCart } from "@/lib/cart/guest-storage";
import { mergeGuestCart, quoteGuest } from "@/lib/cart/guest-client";
import type { CartSnapshot } from "@/modules/cart/service";

export function CartController({ initialCart }: { initialCart: CartSnapshot | null }) {
  const [state, setState] = useState<{ cart: CartSnapshot; guest: boolean } | null>(null);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (initialCart) {
          try {
            const merged = await mergeGuestCart();
            if (!cancelled) { setState({ cart: merged ?? initialCart, guest: false }); setError(""); }
          } catch (failure) {
            const cart = await quoteGuest(readGuestCart().items);
            if (!cancelled) {
              setState({ cart, guest: true });
              setError((failure instanceof Error ? failure.message : "No pudimos fusionar el carrito.") + " Tu carrito de cuenta se conserva. Ajusta el carrito de invitado y vuelve a intentar.");
            }
          }
        } else {
          const cart = await quoteGuest(readGuestCart().items);
          if (!cancelled) setState({ cart, guest: true });
        }
      } catch (failure) {
        if (!cancelled) setError(failure instanceof Error ? failure.message : "No pudimos leer el carrito guardado.");
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [initialCart, attempt]);
  return <>
    {error && <div role="alert" className="form-error"><p>{error}</p><button className="button button-dark" onClick={() => setAttempt(a => a + 1)}>Volver a intentar</button></div>}
    {state ? <CartView key={`${attempt}-${state.guest}`} initialCart={state.cart} guest={state.guest} /> : <p role="status">Consultando tu carrito…</p>}
  </>;
}
