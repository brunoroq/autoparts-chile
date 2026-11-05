import Link from "next/link";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { listOrders } from "@/modules/orders/service";
import { orderLabels } from "@/modules/orders/labels";
import { formatClp } from "@/lib/format";
export const dynamic = "force-dynamic";
export const metadata = { title: "Mis pedidos" };
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const user = await currentUser();
  if (!user) redirect("/iniciar-sesion?callbackUrl=%2Fpedidos");
  const raw = (await searchParams).page;
  const page = raw && /^[1-9]\d{0,4}$/.test(raw) ? Number(raw) : 1;
  const data = await listOrders(user.id, page);
  return (
    <div className="container cart-page">
      <div className="catalog-heading">
        <p className="eyebrow red">TU CUENTA</p>
        <h1>
          Mis pedidos<span className="red">.</span>
        </h1>
        <p>Consulta tus compras de prueba y sus estados de pago.</p>
      </div>
      {data.items.length ? (
        data.items.map((o) => (
          <article className="order-line" key={o.id}>
            <h2>
              <Link href={"/pedidos/" + o.id}>Pedido {o.id.slice(0, 8)} →</Link>
            </h2>
            <p>
              {orderLabels[o.status]} ·{" "}
              {new Date(o.createdAt).toLocaleString("es-CL", {
                timeZone: "America/Santiago",
              })}
            </p>
            <strong>{formatClp(o.totalClp)}</strong>
          </article>
        ))
      ) : (
        <p>
          No hay pedidos en esta página.{" "}
          <Link href="/catalogo">Explorar catálogo →</Link>
        </p>
      )}
      <nav className="payment-actions" aria-label="Paginación de pedidos">
        {page > 1 && (
          <Link href={"/pedidos?page=" + (page - 1)}>← Anterior</Link>
        )}
        {data.hasNext && (
          <Link href={"/pedidos?page=" + (page + 1)}>Siguiente →</Link>
        )}
      </nav>
    </div>
  );
}
