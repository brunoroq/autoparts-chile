import { prisma } from "../../lib/db/prisma";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { ApiError } from "../../lib/http/errors";
import { measure } from "../../lib/observability/request";
import { productIdInput, quantityInput } from "./validation";

async function snapshot(tx: Prisma.TransactionClient, userId: string) {
  const cart = await tx.cart.findUnique({
    where: { userId },
    select: {
      version: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          quantity: true,
          product: {
            select: {
              id: true,
              slug: true,
              name: true,
              priceClp: true,
              stock: true,
              active: true,
              imagePath: true,
              imageAlt: true,
            },
          },
        },
      },
    },
  });
  const items = (cart?.items ?? []).map(({ quantity, product }) => ({
    productId: product.id,
    slug: product.slug,
    name: product.name,
    imagePath: product.imagePath,
    imageAlt: product.imageAlt,
    unitPriceClp: product.priceClp,
    quantity,
    subtotalClp: product.priceClp * quantity,
    availableStock: product.stock,
    active: product.active,
    available: product.active && product.stock >= quantity,
    warning: !product.active
      ? "Producto no disponible."
      : product.stock < quantity
        ? "La cantidad supera el stock actual."
        : null,
  }));
  return {
    version: cart?.version ?? 0,
    items,
    totalClp: items.reduce((total, item) => total + item.subtotalClp, 0),
    currency: "CLP" as const,
  };
}

export type CartSnapshot = Awaited<ReturnType<typeof snapshot>>;

export function readCart(userId: string, client: PrismaClient = prisma) {
  return measure("db", () =>
    client.$transaction((tx) => snapshot(tx, userId), {
      isolationLevel: "RepeatableRead",
    }),
  );
}

export async function changeCart(
  userId: string,
  version: number,
  operation: "add" | "set" | "remove",
  productId: string,
  quantity?: number,
  client: PrismaClient = prisma,
) {
  productIdInput(productId);
  if (operation !== "remove") quantityInput(quantity);
  try {
    return await measure("db", () =>
      client.$transaction(
        async (tx) => {
          let cart = await tx.cart.findUnique({
            where: { userId },
            select: { id: true, version: true },
          });
          if (!cart)
            cart = await tx.cart.create({
              data: { userId },
              select: { id: true, version: true },
            });
          // UPDATE condicional toma el bloqueo de fila y reevalúa version después de esperar.
          const updated = await tx.cart.updateMany({
            where: { id: cart.id, userId, version },
            data: { version: { increment: 1 } },
          });
          if (updated.count !== 1)
            throw new ApiError(
              "Tu carrito cambió en otra ventana. Lo actualizamos para que revises los cambios.",
              409,
              "CART_CONFLICT",
            );
          const key = { cartId_productId: { cartId: cart.id, productId } };
          const item = await tx.cartItem.findUnique({
            where: key,
            select: { quantity: true },
          });
          if (operation === "remove") {
            if (!item)
              throw new ApiError(
                "El producto no está en tu carrito.",
                404,
                "ITEM_NOT_FOUND",
              );
            await tx.cartItem.delete({ where: key });
          } else {
            const product = await tx.product.findUnique({
              where: { id: productId },
              select: { active: true, stock: true },
            });
            if (!product?.active)
              throw new ApiError(
                "Producto no disponible.",
                404,
                "PRODUCT_NOT_FOUND",
              );
            if (operation === "set" && !item)
              throw new ApiError(
                "El producto no está en tu carrito.",
                404,
                "ITEM_NOT_FOUND",
              );
            const finalQuantity =
              operation === "add"
                ? (item?.quantity ?? 0) + quantity!
                : quantity!;
            if (finalQuantity > 99 || finalQuantity > product.stock)
              throw new ApiError(
                "La cantidad solicitada supera el stock disponible o el máximo de 99 unidades.",
                409,
                "STOCK_CONFLICT",
              );
            await tx.cartItem.upsert({
              where: key,
              create: { cartId: cart.id, productId, quantity: finalQuantity },
              update: { quantity: finalQuantity },
            });
          }
          return snapshot(tx, userId);
        },
        { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 10000 },
      ),
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ["P2002", "P2034"].includes(error.code)
    )
      throw new ApiError(
        "Tu carrito cambió. Actualiza y vuelve a intentar.",
        409,
        "CART_CONFLICT",
      );
    throw error;
  }
}
