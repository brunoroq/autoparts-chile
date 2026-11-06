"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckoutView } from "@/components/orders/checkout-view";
import { mergeGuestCart } from "@/lib/cart/guest-client";
import type { CartSnapshot } from "@/modules/cart/service";

// Evitar checkout/evento begin_checkout con una fusión todavía pendiente.
export function CheckoutCart({ cart, provider }: { cart: CartSnapshot; provider: string }) {
  const [ready, setReady] = useState<CartSnapshot | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void mergeGuestCart().then(merged => {
      if (!cancelled) setReady(merged ?? cart);
    }).catch(failure => {
      if (!cancelled) setError(failure instanceof Error ? failure.message : "Revisa tu carrito antes de continuar.");
    });
    return () => { cancelled = true; };
  }, [cart]);
  if (error) return <div role="alert"><p>{error}</p><Link className="button button-red" href="/carrito">Revisar carrito</Link></div>;
  return ready ? <CheckoutView cart={ready} provider={provider} /> : <p role="status">Preparando tu carrito…</p>;
}
