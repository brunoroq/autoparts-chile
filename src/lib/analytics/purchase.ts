import { prisma } from "../db/prisma";
import type { PrismaClient } from "../../generated/prisma/client";
import { ApiError } from "../http/errors";
import { measure } from "../observability/request";
import { commerce, safeCommerce } from "./contracts";
export function claimPurchase(
  userId: string,
  orderId: string,
  client: PrismaClient = prisma,
) {
  return measure("db", () =>
    client.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderId, userId },
        include: { items: true },
      });
      if (!order)
        throw new ApiError("Pedido no encontrado.", 404, "ORDER_NOT_FOUND");
      if (order.status !== "PAID")
        throw new ApiError(
          "La compra aún no está confirmada.",
          409,
          "ORDER_NOT_PAID",
        );
      const value = safeCommerce(commerce(order.items, order.id));
      if (!value) return null;
      const claim = await tx.order.updateMany({
        where: {
          id: orderId,
          userId,
          status: "PAID",
          analyticsPurchaseClaimedAt: null,
        },
        data: { analyticsPurchaseClaimedAt: new Date() },
      });
      return claim.count ? value : null;
    }),
  );
}
