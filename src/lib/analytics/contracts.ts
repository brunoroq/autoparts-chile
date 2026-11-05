export type AnalyticsItem = {
  item_id: string;
  price: number;
  quantity: number;
};
export type Commerce = {
  currency: "CLP";
  value: number;
  items: AnalyticsItem[];
  transaction_id?: string;
};
export type CommerceEvent =
  | "view_item"
  | "add_to_cart"
  | "begin_checkout"
  | "purchase";
// No nombres libres: los IDs del catálogo permiten analizar productos sin texto ingresado por usuarios.
export function commerce(
  items: { productId: string; unitPriceClp: number; quantity: number }[],
  transactionId?: string,
): Commerce {
  return {
    currency: "CLP",
    value: items.reduce((n, i) => n + i.unitPriceClp * i.quantity, 0),
    items: items.map((i) => ({
      item_id: i.productId,
      price: i.unitPriceClp,
      quantity: i.quantity,
    })),
    ...(transactionId ? { transaction_id: transactionId } : {}),
  };
}
export function safeCommerce(value: Commerce): Commerce | null {
  if (
    value.currency !== "CLP" ||
    !value.items.length ||
    value.items.length > 200
  )
    return null;
  const items = value.items.map((i) => ({
    item_id: i.item_id,
    price: i.price,
    quantity: i.quantity,
  }));
  if (
    items.some(
      (i) =>
        !/^[a-f0-9-]{36}$/i.test(i.item_id) ||
        !Number.isInteger(i.price) ||
        i.price < 0 ||
        !Number.isInteger(i.quantity) ||
        i.quantity < 1 ||
        i.quantity > 99,
    )
  )
    return null;
  const total = items.reduce((n, i) => n + i.price * i.quantity, 0);
  if (!Number.isSafeInteger(total) || total !== value.value) return null;
  if (value.transaction_id && !/^[a-f0-9-]{36}$/i.test(value.transaction_id))
    return null;
  return {
    currency: "CLP",
    value: total,
    items,
    ...(value.transaction_id ? { transaction_id: value.transaction_id } : {}),
  };
}
export function normalizedPath(path: string) {
  if (path.startsWith("/productos/")) return "/productos/[slug]";
  if (path.startsWith("/pedidos/")) return "/pedidos/[id]";
  return [
    "/",
    "/catalogo",
    "/carrito",
    "/checkout",
    "/pedidos",
    "/registro",
    "/iniciar-sesion",
  ].includes(path)
    ? path
    : "/otra";
}
export type AnalyticsConfig = {
  measurementId: string;
  enabled: boolean;
  vitals: boolean;
  environment: string;
  experimentId: string;
  traffic: "human" | "synthetic";
  debug: boolean;
  origin: string;
};
