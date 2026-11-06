import type { Metadata } from "next";
import { currentUser } from "@/lib/auth/session";
import { readCart } from "@/modules/cart/service";
import { CartController } from "@/components/cart/cart-controller";
export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Tu carrito" };
export default async function CartPage() {
  const user = await currentUser();
  const cart = user ? await readCart(user.id) : null;
  return (
    <div className="container cart-page">
      <CartController initialCart={cart} />
    </div>
  );
}
