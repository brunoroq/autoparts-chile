import { ApiError } from "../../lib/http/errors";
import { exactFields } from "../../lib/http/input";

export function productIdInput(id: unknown): string {
  if (
    typeof id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)
  )
    throw new ApiError("Identificador de producto inválido.");
  return id;
}
export function quantityInput(value: unknown): number {
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 99
  )
    throw new ApiError(
      "La cantidad debe ser un entero entre 1 y 99.",
      400,
      "INVALID_QUANTITY",
    );
  return value;
}
export function cartBody(body: Record<string, unknown>, add: boolean) {
  exactFields(body, add ? ["productId", "quantity"] : ["quantity"]);
  return {
    quantity: quantityInput(body.quantity),
    ...(add ? { productId: productIdInput(body.productId) } : {}),
  };
}
export function cartVersion(header: string | null) {
  if (header === null)
    throw new ApiError(
      "Actualiza el carrito antes de modificarlo.",
      428,
      "VERSION_REQUIRED",
    );
  if (!/^"(0|[1-9]\d{0,9})"$/.test(header))
    throw new ApiError("La versión del carrito no es válida.");
  const version = Number(header.slice(1, -1));
  if (version >= 2147483647)
    throw new ApiError("La versión del carrito está fuera de rango.");
  return version;
}
