import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth/session";
import { readCart } from "@/modules/cart/service";
import { CartView } from "@/components/cart/cart-view";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu carrito" };
export default async function CartPage() {
  const user = await currentUser();
  if (!user) redirect("/iniciar-sesion?callbackUrl=%2Fcarrito");
  const cart = await readCart(user.id);
  return (
    <div className="container cart-page">
      <CartView initialCart={cart} />
    </div>
  );
}
