import { prisma } from "../../lib/db/prisma";
import type { PrismaClient } from "../../generated/prisma/client";
import type { CartSnapshot } from "./service";
import type { GuestItem } from "./guest-validation";
import { measure } from "../../lib/observability/request";

// Solo lectura: los importes y la disponibilidad provienen de PostgreSQL.
export async function quoteGuestCart(input: GuestItem[], client: PrismaClient = prisma): Promise<CartSnapshot> {
  const products = await measure("db", () => client.product.findMany({
    where: { id: { in: input.map(i => i.productId) } },
    select: { id: true, slug: true, name: true, priceClp: true, stock: true, active: true, imagePath: true, imageAlt: true },
  }));
  const items = input.map(({ productId, quantity }) => {
    const product = products.find(p => p.id === productId);
    const active = product?.active ?? false;
    const stock = product?.stock ?? 0;
    const price = product?.priceClp ?? 0;
    return { productId, quantity, slug: product?.slug ?? "", name: product?.name ?? "Producto no disponible", imagePath: product?.imagePath ?? "/images/products/fallback.webp", imageAlt: product?.imageAlt ?? "Accesorio no disponible", unitPriceClp: price, subtotalClp: price * quantity, availableStock: stock, active, available: active && stock >= quantity, warning: !active ? "Producto no disponible. Elimínalo para continuar." : stock < quantity ? "La cantidad supera el stock actual." : null };
  });
  return { version: 0, items, totalClp: items.reduce((sum, i) => sum + i.subtotalClp, 0), currency: "CLP" };
}
