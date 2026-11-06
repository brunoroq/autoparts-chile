import { ApiError } from "../../lib/http/errors";
import { exactFields } from "../../lib/http/input";
import { productIdInput, quantityInput } from "./validation";

export type GuestItem = { productId: string; quantity: number };
export function guestItems(value: unknown): GuestItem[] {
  if (!Array.isArray(value) || value.length > 50)
    throw new ApiError("El carrito admite hasta 50 productos distintos.");
  const ids = new Set<string>();
  return value.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new ApiError("Producto de carrito inválido.");
    const item = entry as Record<string, unknown>;
    exactFields(item, ["productId", "quantity"]);
    const productId = productIdInput(item.productId).toLowerCase();
    if (ids.has(productId)) throw new ApiError("Producto repetido en el carrito.");
    ids.add(productId);
    return { productId, quantity: quantityInput(item.quantity) };
  }).sort((a, b) => a.productId.localeCompare(b.productId));
}
