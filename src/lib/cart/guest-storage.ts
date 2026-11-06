import { guestItems, type GuestItem } from "../../modules/cart/guest-validation";

export const guestCartKey = "autoparts:guest-cart:v1";
export type GuestCart = {
  items: GuestItem[];
  pending?: { id: string; userId: string; items: GuestItem[] };
};
export function parseGuestCart(raw: string | null): GuestCart {
  if (!raw) return { items: [] };
  const value = JSON.parse(raw);
  const items = guestItems(value.items);
  if (!value.pending) return { items };
  const { id, userId } = value.pending;
  if (typeof id !== "string" || !/^[a-f0-9-]{36}$/i.test(id) || typeof userId !== "string")
    throw new Error("El carrito guardado no es válido. No se sobrescribió.");
  const pendingItems = guestItems(value.pending.items);
  if (JSON.stringify(items) !== JSON.stringify(pendingItems))
    throw new Error("El carrito tiene una fusión pendiente distinta. No se sobrescribió.");
  return { items, pending: { id, userId, items: pendingItems } };
}
export function readGuestCart() { return parseGuestCart(localStorage.getItem(guestCartKey)); }
export function writeGuestCart(cart: GuestCart) {
  localStorage.setItem(guestCartKey, JSON.stringify(cart));
  window.dispatchEvent(new Event("guest-cart"));
}
// Las lecturas/modificaciones y la confirmación se serializan también entre pestañas.
export async function withGuestLock<T>(operation: () => Promise<T>): Promise<T> {
  if (!navigator.locks)
    throw new Error("Este navegador no permite guardar el carrito de forma segura entre pestañas. Usa una versión actual de Chrome, Firefox o Safari.");
  return navigator.locks.request("autoparts-guest-cart", operation);
}
