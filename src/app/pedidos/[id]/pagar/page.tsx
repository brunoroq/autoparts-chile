import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { paymentRedirect } from "@/modules/orders/service";
import { decryptToken } from "@/modules/payments/providers";
import Link from "next/link";
export const dynamic = "force-dynamic";
export const metadata = {
  title: "Webpay de integración",
  robots: { index: false, follow: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await currentUser();
  if (!user) redirect("/iniciar-sesion");
  const payment = await paymentRedirect(user.id, id);
  return (
    <div className="container cart-page">
      <div className="catalog-heading">
        <h1>
          Webpay de integración<span className="red">.</span>
        </h1>
        <p>Utiliza únicamente los datos de prueba oficiales de Transbank.</p>
      </div>
      <form action={payment.url} method="POST">
        <input
          type="hidden"
          name="token_ws"
          value={decryptToken(payment.tokenCipher)}
        />
        <button className="button button-red">Ir al pago de prueba →</button>
      </form>
      <Link href={"/pedidos/" + id}>← Volver al pedido</Link>
    </div>
  );
}
