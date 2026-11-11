import { readGuestCart, writeGuestCart, withGuestLock } from "./guest-storage";
import { guestItems, type GuestItem } from "../../modules/cart/guest-validation";
import type { CartSnapshot } from "../../modules/cart/service";

export async function quoteGuest(items: GuestItem[]): Promise<CartSnapshot> {
  // Sin productos no existen precios/stock que consultar. También cubre eliminar
  // la última línea, sin enviar una cotización vacía ni alterar la fusión pendiente.
  if (items.length === 0) return { version: 0, items: [], totalClp: 0, currency: "CLP" };
  const response = await fetch("/api/v1/cart/guest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ items }), cache: "no-store" });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error?.message ?? "No pudimos consultar los precios actuales.");
  return result.data;
}
export function changeGuest(productId: string, operation: "add" | "set" | "remove", quantity = 1) {
  return withGuestLock(async () => {
    const stored = readGuestCart();
    if (stored.pending) throw new Error("Hay una fusión pendiente. Inicia sesión y confírmala antes de modificar este carrito.");
    const current = stored.items.find(i => i.productId === productId)?.quantity ?? 0;
    const items = stored.items.filter(i => i.productId !== productId);
    if (operation !== "remove") items.push({ productId, quantity: operation === "add" ? current + quantity : quantity });
    const validated = guestItems(items);
    const cart = await quoteGuest(validated);
    if (operation !== "remove" && !cart.items.find(i => i.productId === productId)?.available)
      throw new Error("La cantidad supera el stock disponible o el producto ya no está disponible.");
    writeGuestCart({ items: validated });
    return cart;
  });
}
export function mergeGuestCart() {
  return withGuestLock(async () => {
    const stored = readGuestCart();
    if (!stored.items.length) return;
    const sessionResponse = await fetch("/api/auth/session", { cache: "no-store" });
    const session = await sessionResponse.json();
    const userId = session.user?.id;
    if (!userId) throw new Error("Inicia sesión para guardar tu carrito.");
    if (stored.pending && stored.pending.userId !== userId)
      throw new Error("La fusión pendiente pertenece a otra sesión. Vuelve a ingresar con la cuenta original para confirmarla.");
    const pending = stored.pending ?? { id: crypto.randomUUID(), userId, items: stored.items };
    // Persistir ANTES de enviar: una respuesta perdida reutiliza la misma clave y contenido.
    writeGuestCart({ items: stored.items, pending });
    const response = await fetch("/api/v1/cart/merge", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mergeId: pending.id, items: pending.items }), cache: "no-store" });
    const result = await response.json();
    if (!response.ok) {
      // Solo estos errores garantizan que la transacción no se aplicó. Un error
      // técnico/red conserva la clave para resolver el resultado indeterminado.
      if (["STOCK_CONFLICT", "PRODUCT_NOT_FOUND", "INVALID_QUANTITY"].includes(result.error?.code))
        writeGuestCart({ items: stored.items });
      throw new Error(result.error?.message ?? "No pudimos confirmar la fusión. Tu carrito de invitado se conserva; vuelve a intentar.");
    }
    writeGuestCart({ items: [] });
    return result.data as CartSnapshot;
  });
}
