"use client";
import { CommerceView } from "@/components/analytics/analytics-provider";
import { commerce } from "@/lib/analytics/contracts";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { CartSnapshot } from "@/modules/cart/service";
import { formatClp } from "@/lib/format";
import Link from "next/link";
export function CheckoutView({
  cart,
  provider,
}: {
  cart: CartSnapshot;
  provider: string;
}) {
  const router = useRouter(),
    key = useRef<string | null>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  async function submit() {
    setBusy(true);
    setError("");
    key.current ??= crypto.randomUUID();
    try {
      const response = await fetch("/api/v1/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": key.current,
        },
        body: JSON.stringify({ cartVersion: cart.version }),
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result.error?.message || "No pudimos crear el pedido.");
        return;
      }
      router.push("/pedidos/" + result.data.id);
      router.refresh();
    } catch {
      setError("No pudimos conectar. Repite para recuperar el mismo pedido.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <CommerceView
        name="begin_checkout"
        eventKey={JSON.stringify([
          cart.version,
          cart.items.map((i) => [i.productId, i.quantity, i.unitPriceClp]),
        ])}
        value={commerce(cart.items)}
      />
      <div className="catalog-heading">
        <p className="eyebrow red">ÚLTIMO PASO</p>
        <h1>
          Revisa tu compra<span className="red">.</span>
        </h1>
        <p>
          Compra académica de prueba. El stock se verifica al confirmar el pago.
        </p>
      </div>
      <div className="cart-layout">
        <section aria-label="Resumen de compra">
          {cart.items.map((i) => (
            <article className="order-line" key={i.productId}>
              <h2>{i.name}</h2>
              <p>
                {i.quantity} × {formatClp(i.unitPriceClp)}
              </p>
              <strong>{formatClp(i.subtotalClp)}</strong>
              {i.warning && <p className="form-error">{i.warning}</p>}
            </article>
          ))}
          <Link href="/carrito">← Volver al carrito</Link>
        </section>
        <aside className="cart-summary">
          <h2>Tu compra de prueba</h2>
          <p className="cart-total">
            <span>Total CLP</span>
            <strong>{formatClp(cart.totalClp)}</strong>
          </p>
          <p className="form-help">
            {provider === "SIMULATED"
              ? "Pago simulado: no se contactará ningún banco."
              : "Webpay Plus en integración: utiliza exclusivamente tarjetas de prueba."}
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button
            className="button button-red"
            onClick={() => void submit()}
            disabled={
              busy || !cart.items.length || cart.items.some((i) => !i.available)
            }
          >
            {busy ? "Creando pedido…" : "Crear pedido de prueba"}
          </button>
          <p className="form-help">
            Sin despacho ni facturación. Los precios finales se calculan en el
            servidor.
          </p>
        </aside>
      </div>
    </>
  );
}
