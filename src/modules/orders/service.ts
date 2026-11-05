import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../../lib/db/prisma";
import { Prisma, type PrismaClient } from "../../generated/prisma/client";
import { ApiError } from "../../lib/http/errors";
import { measure } from "../../lib/observability/request";
import { AttemptLimiter } from "../../lib/auth/rate-limit";
import {
  encryptToken,
  tokenHash,
  paymentProvider,
  simulatedGateway,
  webpayGateway,
  type Evidence,
  type PaymentGateway,
  type Scenario,
} from "../payments/providers";

const include = {
  items: { orderBy: { id: "asc" as const } },
  payments: { orderBy: { createdAt: "asc" as const } },
};
const webpayLimiter = new AttemptLimiter();
type StoredOrder = Prisma.OrderGetPayload<{ include: typeof include }>;
function dto(order: StoredOrder) {
  const p = order.payments[0];
  return {
    id: order.id,
    status: order.status,
    totalClp: order.totalClp,
    currency: "CLP",
    createdAt: order.createdAt.toISOString(),
    items: order.items.map((i) => ({
      productId: i.productId,
      name: i.productName,
      unitPriceClp: i.unitPriceClp,
      quantity: i.quantity,
      subtotalClp: i.unitPriceClp * i.quantity,
    })),
    payment: p
      ? {
          id: p.id,
          provider: p.provider,
          status: p.status,
          providerState: p.providerState,
          reversalResult: p.reversalResult,
          canResume: p.status === "PENDING" && !!p.tokenCipher,
          canSimulate: p.provider === "SIMULATED" && p.status === "PENDING",
        }
      : null,
  };
}
export type OrderView = ReturnType<typeof dto>;
export async function readOrder(
  userId: string,
  id: string,
  client: PrismaClient = prisma,
) {
  const order = await measure("db", () =>
    client.order.findFirst({ where: { id, userId }, include }),
  );
  if (!order)
    throw new ApiError("Pedido no encontrado.", 404, "ORDER_NOT_FOUND");
  return dto(order);
}
export async function listOrders(
  userId: string,
  page = 1,
  client: PrismaClient = prisma,
) {
  const orders = await measure("db", () =>
    client.order.findMany({
      where: { userId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * 20,
      take: 21,
      include,
    }),
  );
  return {
    items: orders.slice(0, 20).map(dto),
    page,
    hasNext: orders.length > 20,
  };
}
const gatewayFor = (provider: string) =>
  provider === "SIMULATED" ? simulatedGateway : webpayGateway();

export async function checkout(
  userId: string,
  version: number,
  key: string,
  client: PrismaClient = prisma,
  gateway?: PaymentGateway,
) {
  const provider = paymentProvider();
  const hash = createHash("sha256")
    .update(JSON.stringify({ version }))
    .digest("hex");
  let order: StoredOrder;
  try {
    order = await measure("db", () =>
      client.$transaction(async (tx) => {
        // Serializa intentos del mismo carrito sin reservar existencias ni llamar al proveedor.
        await tx.$queryRaw`SELECT id FROM "Cart" WHERE "userId" = ${userId}::uuid FOR UPDATE`;
        const existing = await tx.order.findUnique({
          where: { userId_idempotencyKey: { userId, idempotencyKey: key } },
          include,
        });
        if (existing) {
          if (existing.requestHash !== hash)
            throw new ApiError(
              "La clave ya se utilizó con otra solicitud.",
              409,
              "IDEMPOTENCY_CONFLICT",
            );
          return existing;
        }
        const cart = await tx.cart.findUnique({
          where: { userId },
          include: { items: { include: { product: true } } },
        });
        if (!cart || cart.version !== version)
          throw new ApiError(
            "El carrito cambió. Revísalo antes de comprar.",
            409,
            "CART_CONFLICT",
          );
        const pending = await tx.order.findFirst({
          where: { cartId: cart.id, status: { in: ["PENDING", "REVIEW"] } },
        });
        if (pending)
          throw new ApiError(
            "Ya tienes un pedido pendiente. Revísalo en Mis pedidos.",
            409,
            "ORDER_PENDING",
          );
        if (!cart.items.length)
          throw new ApiError("Tu carrito está vacío.", 409, "EMPTY_CART");
        let total = 0;
        for (const i of cart.items) {
          if (
            !i.product.active ||
            i.quantity < 1 ||
            i.quantity > 99 ||
            i.product.stock < i.quantity
          )
            throw new ApiError(
              "Revisa la disponibilidad de los productos.",
              409,
              "STOCK_CONFLICT",
            );
          total += i.product.priceClp * i.quantity;
        }
        if (!Number.isSafeInteger(total) || total <= 0 || total > 2147483647)
          throw new ApiError(
            "El total está fuera del rango admitido.",
            400,
            "INVALID_TOTAL",
          );
        return tx.order.create({
          data: {
            userId,
            cartId: cart.id,
            cartVersion: version,
            idempotencyKey: key,
            requestHash: hash,
            totalClp: total,
            items: {
              create: cart.items.map((i) => ({
                productId: i.productId,
                productName: i.product.name,
                unitPriceClp: i.product.priceClp,
                quantity: i.quantity,
              })),
            },
            payments: {
              create: {
                provider,
                amountClp: total,
                externalReference: "AP" + randomBytes(12).toString("hex"),
                sessionId: randomBytes(24).toString("hex"),
              },
            },
          },
          include,
        });
      }),
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    )
      throw new ApiError(
        "Solicitud simultánea. Repite con la misma clave.",
        409,
        "CHECKOUT_CONFLICT",
      );
    throw error;
  }
  const p = order.payments[0];
  if (
    p.provider === "WEBPAY_INTEGRATION" &&
    p.status === "PENDING" &&
    !p.tokenCipher
  ) {
    const operation = randomBytes(12).toString("hex");
    const claimed = await measure("db", () =>
      client.paymentAttempt.updateMany({
        where: { id: p.id, status: "PENDING", operation: null },
        data: { status: "PROCESSING", operation, operationAt: new Date() },
      }),
    );
    if (claimed.count) {
      try {
        const result = await measure("provider", () =>
          (gateway ?? gatewayFor(p.provider)).create(p),
        );
        await measure("db", () =>
          client.paymentAttempt.updateMany({
            where: { id: p.id, operation },
            data: {
              status: "PENDING",
              tokenHash: tokenHash(result.token),
              tokenCipher: encryptToken(result.token),
              redirectUrl: result.url,
              operation: null,
              operationAt: null,
            },
          }),
        );
      } catch {
        // Sin token no se puede consultar con certeza: jamás repetir create automáticamente.
        await measure("db", () =>
          client.$transaction([
            client.paymentAttempt.updateMany({
              where: { id: p.id, operation },
              data: {
                status: "UNKNOWN",
                operation: null,
                providerState: "CREATE_UNCERTAIN",
              },
            }),
            client.order.update({
              where: { id: order.id },
              data: { status: "REVIEW" },
            }),
          ]),
        );
      }
    }
  }
  return readOrder(userId, order.id, client);
}

function matches(e: Evidence, p: StoredOrder["payments"][number]) {
  return (
    e.amount === p.amountClp &&
    e.buyOrder === p.externalReference &&
    e.sessionId === p.sessionId
  );
}
// Se usa también tras reiniciar: el estado durable decide consultar, nunca repetir cargos o reversas.
export async function processPayment(
  userId: string | null,
  paymentId: string,
  action: "commit" | "reconcile",
  scenario?: Scenario,
  client: PrismaClient = prisma,
  gateway?: PaymentGateway,
) {
  const initial = await measure("db", () =>
    client.paymentAttempt.findFirst({
      where: { id: paymentId, ...(userId ? { order: { userId } } : {}) },
      include: { order: { include } },
    }),
  );
  if (!initial)
    throw new ApiError("Pago no encontrado.", 404, "PAYMENT_NOT_FOUND");
  const p = initial;
  const owner = p.order.userId;
  if (["APPROVED", "REJECTED", "CANCELLED", "REVERSED"].includes(p.status))
    return readOrder(owner, p.orderId, client);
  if (
    p.provider === "SIMULATED" &&
    action === "reconcile" &&
    !p.simulatedOutcome
  )
    return readOrder(owner, p.orderId, client);
  if (
    p.provider === "SIMULATED" &&
    action === "commit" &&
    (!scenario || paymentProvider() !== "SIMULATED")
  )
    throw new ApiError("Simulación no disponible.", 409, "PROVIDER_CONFLICT");
  if (p.provider === "WEBPAY_INTEGRATION" && !p.tokenCipher) {
    if (
      p.status === "PROCESSING" &&
      p.operationAt &&
      Date.now() - p.operationAt.getTime() >= 30000 &&
      p.operation
    )
      await uncertain(
        client,
        p.id,
        p.orderId,
        p.operation,
        "UNKNOWN",
        "CREATE_UNCERTAIN",
      );
    return readOrder(owner, p.orderId, client);
  }
  const busy = p.operationAt && Date.now() - p.operationAt.getTime() < 30000;
  if (p.operation && busy)
    throw new ApiError(
      "El pago se está verificando. Consulta nuevamente en unos segundos.",
      409,
      "PAYMENT_PROCESSING",
    );
  if (p.provider === "WEBPAY_INTEGRATION") {
    webpayLimiter.take("webpay:global", 60, 60000);
    webpayLimiter.take(p.id, 6, 60000);
  }
  const operation = randomBytes(12).toString("hex");
  const claimed = await measure("db", () =>
    client.paymentAttempt.updateMany({
      where: {
        id: p.id,
        status: p.status,
        operation: p.operation,
        operationAt: p.operationAt,
      },
      data: {
        operation,
        operationAt: new Date(),
        status:
          p.status === "REVERSAL_PENDING" ? "REVERSAL_PENDING" : "PROCESSING",
        ...(p.provider === "SIMULATED" && !p.simulatedOutcome && scenario
          ? { simulatedOutcome: scenario }
          : {}),
      },
    }),
  );
  if (!claimed.count)
    throw new ApiError(
      "Otra solicitud está verificando este pago.",
      409,
      "PAYMENT_PROCESSING",
    );
  const input = {
    ...p,
    simulatedOutcome: p.simulatedOutcome ?? scenario ?? null,
  };
  const adapter = gateway ?? gatewayFor(p.provider);
  let evidence: Evidence;
  try {
    evidence = await measure("provider", () =>
      action === "commit" && p.status === "PENDING"
        ? adapter.commit(input)
        : adapter.status(input),
    );
  } catch {
    await uncertain(
      client,
      p.id,
      p.orderId,
      operation,
      p.status === "REVERSAL_PENDING" ? "REVERSAL_PENDING" : "UNKNOWN",
    );
    return readOrder(owner, p.orderId, client);
  }
  if (!matches(evidence, p)) {
    await uncertain(
      client,
      p.id,
      p.orderId,
      operation,
      "UNKNOWN",
      "IDENTITY_MISMATCH",
    );
    return readOrder(owner, p.orderId, client);
  }
  if (p.status === "REVERSAL_PENDING") {
    const reversed =
      evidence.state === "REVERSED" ||
      (evidence.state === "NULLIFIED" && evidence.balance === 0);
    await finish(
      client,
      p.id,
      p.orderId,
      operation,
      reversed ? "REVERSED" : "REVERSAL_PENDING",
      reversed ? "CANCELLED" : "REVIEW",
      evidence.state,
      reversed ? evidence.state : "UNCONFIRMED",
    );
    return readOrder(owner, p.orderId, client);
  }
  if (evidence.state !== "AUTHORIZED" || evidence.code !== 0) {
    const cancelled = ["ABORTED", "REVERSED", "NULLIFIED"].includes(
      evidence.state,
    );
    const rejected = evidence.state === "FAILED";
    await finish(
      client,
      p.id,
      p.orderId,
      operation,
      cancelled ? "CANCELLED" : rejected ? "REJECTED" : "UNKNOWN",
      cancelled ? "CANCELLED" : rejected ? "FAILED" : "PENDING",
      evidence.state,
    );
    return readOrder(owner, p.orderId, client);
  }
  // Fallar una actualización condicional revierte TODOS los descuentos del pedido.
  try {
    await measure("db", () =>
      client.$transaction(
        async (tx) => {
          await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${p.orderId}::uuid FOR UPDATE`;
          await tx.$queryRaw`SELECT id FROM "PaymentAttempt" WHERE id = ${p.id}::uuid FOR UPDATE`;
          const live = await tx.paymentAttempt.findUniqueOrThrow({
            where: { id: p.id },
          });
          if (live.operation !== operation)
            throw new ApiError(
              "Operación reemplazada por una verificación posterior.",
              409,
              "PAYMENT_PROCESSING",
            );
          const order = await tx.order.findUniqueOrThrow({
            where: { id: p.orderId },
            include: { items: { orderBy: { productId: "asc" } } },
          });
          if (order.status === "PAID") return;
          for (const item of order.items) {
            const changed = await tx.product.updateMany({
              where: {
                id: item.productId,
                active: true,
                stock: { gte: item.quantity },
              },
              data: { stock: { decrement: item.quantity } },
            });
            if (changed.count !== 1)
              throw new ApiError(
                "No hay stock para confirmar el pedido.",
                409,
                "STOCK_CONFLICT",
              );
          }
          await tx.order.update({
            where: { id: order.id },
            data: { status: "PAID" },
          });
          await tx.paymentAttempt.update({
            where: { id: p.id },
            data: {
              status: "APPROVED",
              providerState: "AUTHORIZED",
              operation: null,
              operationAt: null,
            },
          });
          if (order.cartId) {
            const cart = await tx.cart.updateMany({
              where: {
                id: order.cartId,
                userId: owner,
                version: order.cartVersion,
              },
              data: { version: { increment: 1 } },
            });
            if (cart.count)
              await tx.cartItem.deleteMany({ where: { cartId: order.cartId } });
          }
        },
        { timeout: 10000 },
      ),
    );
  } catch (error) {
    if (error instanceof ApiError && error.code === "PAYMENT_PROCESSING")
      throw error;
    // Aun ante fallo local no previsto, el pago autorizado necesita compensación durable.
    const claim = await measure("db", () =>
      client.paymentAttempt.updateMany({
        where: { id: p.id, operation },
        data: { status: "REVERSAL_PENDING", providerState: "AUTHORIZED" },
      }),
    );
    if (!claim.count) return readOrder(owner, p.orderId, client);
    await measure("db", () =>
      client.order.updateMany({
        where: { id: p.orderId, status: { not: "PAID" } },
        data: { status: "REVIEW" },
      }),
    );
    let result = "UNCONFIRMED";
    try {
      result = await measure("provider", () => adapter.refund(input));
    } catch {
      /* Nunca registrar error del SDK: puede contener credenciales. */
    }
    const reversed = ["REVERSED", "NULLIFIED"].includes(result);
    await finish(
      client,
      p.id,
      p.orderId,
      operation,
      reversed ? "REVERSED" : "REVERSAL_PENDING",
      reversed ? "CANCELLED" : "REVIEW",
      "AUTHORIZED",
      result,
    );
  }
  return readOrder(owner, p.orderId, client);
}

async function finish(
  client: PrismaClient,
  id: string,
  orderId: string,
  operation: string,
  status:
    | "REVERSED"
    | "REVERSAL_PENDING"
    | "UNKNOWN"
    | "CANCELLED"
    | "REJECTED",
  orderStatus: "CANCELLED" | "FAILED" | "REVIEW" | "PENDING",
  state: string,
  reversalResult?: string,
) {
  await measure("db", () =>
    client.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM "Order" WHERE id = ${orderId}::uuid FOR UPDATE`;
      const changed = await tx.paymentAttempt.updateMany({
        where: { id, operation },
        data: {
          status,
          providerState: state.slice(0, 40),
          operation: null,
          operationAt: null,
          ...(reversalResult ? { reversalResult } : {}),
        },
      });
      if (changed.count)
        await tx.order.updateMany({
          where: { id: orderId, status: { not: "PAID" } },
          data: { status: orderStatus },
        });
    }),
  );
}
async function uncertain(
  client: PrismaClient,
  id: string,
  orderId: string,
  operation: string,
  status: "UNKNOWN" | "REVERSAL_PENDING",
  state = "INDETERMINATE",
) {
  await finish(client, id, orderId, operation, status, "REVIEW", state);
}
export async function webpayReturn(token: string, commit: boolean) {
  if (!/^[a-z0-9]{20,128}$/i.test(token))
    throw new ApiError("Retorno inválido.");
  const p = await measure("db", () =>
    prisma.paymentAttempt.findUnique({
      where: { tokenHash: tokenHash(token) },
    }),
  );
  if (!p || p.provider !== "WEBPAY_INTEGRATION")
    throw new ApiError("Pago no encontrado.", 404, "PAYMENT_NOT_FOUND");
  return processPayment(null, p.id, commit ? "commit" : "reconcile");
}
export async function webpayReturnMetadata(
  buyOrder: string,
  sessionId: string,
) {
  if (!/^AP[a-f0-9]{24}$/.test(buyOrder) || !/^[a-f0-9]{48}$/.test(sessionId))
    throw new ApiError("Retorno inválido.");
  const p = await measure("db", () =>
    prisma.paymentAttempt.findFirst({
      where: {
        externalReference: buyOrder,
        sessionId,
        provider: "WEBPAY_INTEGRATION",
      },
    }),
  );
  if (!p) throw new ApiError("Pago no encontrado.", 404, "PAYMENT_NOT_FOUND");
  return processPayment(null, p.id, "reconcile");
}
export async function paymentRedirect(userId: string, orderId: string) {
  const order = await measure("db", () =>
    prisma.order.findFirst({
      where: { id: orderId, userId },
      include: { payments: true },
    }),
  );
  const p = order?.payments[0];
  if (
    !p ||
    p.provider !== "WEBPAY_INTEGRATION" ||
    p.status !== "PENDING" ||
    !p.tokenCipher ||
    !p.redirectUrl
  )
    throw new ApiError(
      "Este pago no admite redirección.",
      409,
      "PAYMENT_STATE",
    );
  // El token solo se entrega en un formulario POST al dominio oficial de integración.
  return { url: p.redirectUrl, tokenCipher: p.tokenCipher };
}
