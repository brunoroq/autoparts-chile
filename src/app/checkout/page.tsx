import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { readCart } from "@/modules/cart/service";
import { paymentProvider } from "@/modules/payments/providers";
import { CheckoutCart } from "@/components/cart/checkout-cart";
export const dynamic = "force-dynamic";
export const metadata = { title: "Checkout de prueba" };
export default async function Page() {
  const user = await currentUser();
  if (!user) redirect("/iniciar-sesion?callbackUrl=%2Fcheckout");
  const cart = await readCart(user.id);
  if (!cart.items.length) redirect("/carrito");
  return (
    <div className="container cart-page">
      <CheckoutCart cart={cart} provider={paymentProvider()} />
    </div>
  );
}
