import { createHash } from "node:crypto";
import { prisma } from "../../lib/db/prisma";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { ApiError } from "../../lib/http/errors";
import { measure } from "../../lib/observability/request";
import { guestItems } from "./guest-validation";
import { productIdInput } from "./validation";
import { readCart, snapshot } from "./service";

export async function mergeCart(userId: string, mergeId: string, input: unknown, client: PrismaClient = prisma) {
  mergeId = productIdInput(mergeId).toLowerCase();
  const items = guestItems(input);
  if (!items.length) throw new ApiError("El carrito de invitado está vacío.");
  const requestHash = createHash("sha256").update(JSON.stringify(items)).digest("hex");
  function checkReceipt(receipt: { userId: string; requestHash: string }) {
    if (receipt.userId !== userId || receipt.requestHash !== requestHash)
      throw new ApiError("Esta operación de fusión ya se usó con otro carrito o sesión.", 409, "MERGE_KEY_CONFLICT");
  }
  try {
    return await measure("db", () => client.$transaction(async tx => {
      const existing = await tx.cartMergeReceipt.findUnique({ where: { id: mergeId } });
      if (existing) { checkReceipt(existing); return snapshot(tx, userId); }
      // La clave única serializa reintentos simultáneos. Si otra petición gana,
      // esta transacción se revierte y se recupera su comprobante más abajo.
      await tx.cartMergeReceipt.create({ data: { id: mergeId, userId, requestHash } });
      // UPSERT atómico crea o bloquea la misma fila usada por changeCart/CAS.
      const cart = await tx.cart.upsert({
        where: { userId }, create: { userId, version: 1 },
        update: { version: { increment: 1 } }, select: { id: true },
      });
      const current = await tx.cartItem.findMany({ where: { cartId: cart.id } });
      const products = await tx.product.findMany({ where: { id: { in: items.map(i => i.productId) } }, select: { id: true, active: true, stock: true } });
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (!product?.active) throw new ApiError("Hay un producto no disponible. Revisa tu carrito de invitado.", 404, "PRODUCT_NOT_FOUND");
        const quantity = (current.find(i => i.productId === item.productId)?.quantity ?? 0) + item.quantity;
        if (quantity > 99 || quantity > product.stock)
          throw new ApiError("La suma con tu carrito de cuenta supera el stock o 99 unidades. Ajusta las cantidades del carrito de invitado.", 409, "STOCK_CONFLICT");
        await tx.cartItem.upsert({
          where: { cartId_productId: { cartId: cart.id, productId: item.productId } },
          create: { cartId: cart.id, productId: item.productId, quantity }, update: { quantity },
        });
      }
      return snapshot(tx, userId);
    }, { isolationLevel: "ReadCommitted", maxWait: 5000, timeout: 10000 }));
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const receipt = await measure("db", () => client.cartMergeReceipt.findUnique({ where: { id: mergeId } }));
      if (receipt) { checkReceipt(receipt); return readCart(userId, client); }
    }
    throw error;
  }
}
