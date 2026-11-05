import { PurchaseEvent } from "@/components/analytics/analytics-provider";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { readOrder } from "@/modules/orders/service";
import { orderLabels, paymentLabels } from "@/modules/orders/labels";
import { formatClp } from "@/lib/format";
import { PaymentActions } from "@/components/orders/payment-actions";
import { ApiError } from "@/lib/http/errors";
export const dynamic = "force-dynamic";
export const metadata = { title: "Detalle del pedido" };
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user)
    redirect(
      "/iniciar-sesion?callbackUrl=" + encodeURIComponent("/pedidos/" + id),
    );
  if (!/^[a-f0-9-]{36}$/i.test(id)) notFound();
  const order = await readOrder(user.id, id).catch((e) => {
    if (e instanceof ApiError && e.status === 404) notFound();
    throw e;
  });
  return (
    <div className="container cart-page">
      {order.status==="PAID"&&<PurchaseEvent orderId={order.id}/>}
      <div className="catalog-heading">
        <p className="eyebrow red">PEDIDO {id.slice(0, 8)}</p>
        <h1>
          {orderLabels[order.status]}
          <span className="red">.</span>
        </h1>
        <p>
          Compra académica de prueba ·{" "}
          {order.payment?.provider === "SIMULATED"
            ? "Simulador interno"
            : "Webpay en integración"}
        </p>
      </div>
      <div className="cart-layout">
        <section aria-label="Productos del pedido">
          {order.items.map((i) => (
            <article className="order-line" key={i.productId}>
              <h2>{i.name}</h2>
              <p>
                {i.quantity} × {formatClp(i.unitPriceClp)}
              </p>
              <strong>{formatClp(i.subtotalClp)}</strong>
            </article>
          ))}
          <Link href="/pedidos">← Mis pedidos</Link>
        </section>
        <aside className="cart-summary">
          <h2>Estado del pago</h2>
          <p>
            {order.payment
              ? paymentLabels[order.payment.status]
              : "Sin intento de pago"}
          </p>
          <p className="cart-total">
            <span>Total CLP</span>
            <strong>{formatClp(order.totalClp)}</strong>
          </p>
          {order.status === "REVIEW" && (
            <p className="form-notice">
              El resultado requiere verificación. No repitas la compra hasta
              aclarar el estado del pago.
            </p>
          )}
          {order.payment?.status === "REVERSED" && (
            <p className="form-notice">
              El pago fue revertido. No se descontaron existencias.
            </p>
          )}
          <PaymentActions order={order} />
          <p className="form-help">
            El carrito se conserva si lo modificaste después de crear este
            pedido.
          </p>
        </aside>
      </div>
    </div>
  );
}
