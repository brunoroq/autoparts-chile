"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { OrderView } from "@/modules/orders/service";
export function PaymentActions({ order }: { order: OrderView }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function send(simulate: boolean, scenario?: string) {
    setBusy(true);
    setMessage("");
    try {
      const r = await fetch(
        simulate
          ? "/api/v1/payments/" + order.payment!.id + "/simulate"
          : "/api/v1/orders/" + order.id + "/reconcile",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          ...(simulate ? { body: JSON.stringify({ scenario }) } : {}),
        },
      );
      const result = await r.json();
      if (!r.ok)
        setMessage(result.error?.message || "No pudimos verificar el pago.");
      else setMessage("Estado actualizado.");
      router.refresh();
    } catch {
      setMessage("Sin conexión. Verifica el estado antes de volver a pagar.");
    } finally {
      setBusy(false);
    }
  }
  if (!order.payment) return null;
  const pending = [
    "PENDING",
    "PROCESSING",
    "UNKNOWN",
    "REVERSAL_PENDING",
  ].includes(order.payment.status);
  return (
    <div className="payment-actions">
      {order.payment.canSimulate && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(
              true,
              String(new FormData(e.currentTarget).get("scenario")),
            );
          }}
        >
          <label htmlFor="scenario">Escenario de pago simulado</label>
          <select id="scenario" name="scenario" disabled={busy}>
            <option value="approved">Aprobado</option>
            <option value="rejected">Rechazado</option>
            <option value="cancelled">Cancelado</option>
            <option value="timeout">Timeout sin autorización</option>
            <option value="timeout-approved">
              Timeout con autorización recuperable
            </option>
            <option value="reversal-failed">
              Aprobado; reversa no confirmada si falta stock
            </option>
            <option value="reversal-timeout">
              Aprobado; timeout en reversa si falta stock
            </option>
          </select>
          <button className="button button-red" disabled={busy}>
            Simular pago
          </button>
        </form>
      )}
      {order.payment.canResume && (
        <Link
          className="button button-red"
          href={"/pedidos/" + order.id + "/pagar"}
        >
          Continuar a Webpay de integración →
        </Link>
      )}
      {pending && (
        <button
          className="button button-dark"
          disabled={busy}
          onClick={() => void send(false)}
        >
          Verificar estado del pago
        </button>
      )}
      {message && (
        <p role="status" className="form-notice">
          {message}
        </p>
      )}
    </div>
  );
}
