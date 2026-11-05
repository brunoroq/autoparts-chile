import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { checkoutTestUrl } from "./checkout-database.ts";
import {
  checkout,
  processPayment,
  readOrder,
  listOrders,
} from "../src/modules/orders/service.ts";
import { changeCart, readCart } from "../src/modules/cart/service.ts";
import {
  simulatedGateway,
  encryptToken,
  type PaymentGateway,
  type PaymentInput,
} from "../src/modules/payments/providers.ts";

process.env.PAYMENT_PROVIDER = "simulated";
process.env.WEBPAY_ENVIRONMENT = "integration";
process.env.PAYMENT_TOKEN_SECRET = "ab".repeat(32); // Solo fixture aislado, nunca una credencial real.
const makeClient = () =>
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: checkoutTestUrl(), max: 8 }),
  });
const client = makeClient();
test.after(async () => {
  await client.$disconnect();
});
async function fixture(stock = 10, price = 12345) {
  const suffix = randomUUID();
  const category = await client.category.findFirstOrThrow();
  const product = await client.product.create({
    data: {
      sku: suffix,
      slug: suffix,
      name: "Producto aislado",
      description: "Prueba checkout",
      categoryId: category.id,
      stock,
      priceClp: price,
    },
  });
  const user = await buyer(product.id);
  return { user, product };
}
async function buyer(productId: string) {
  const u = await client.user.create({
    data: { email: `${randomUUID()}@example.invalid`, cart: { create: {} } },
  });
  await changeCart(u.id, 0, "add", productId, 1, client);
  return u;
}
const buy = (userId: string, key = randomUUID()) =>
  checkout(userId, 1, key, client);
const paid = (userId: string, paymentId: string) =>
  processPayment(userId, paymentId, "commit", "approved", client);

test("pedido: snapshot, precios del servidor, idempotencia y carrito posterior", async () => {
  const { user, product } = await fixture();
  const key = randomUUID();
  const [a, b] = await Promise.all([buy(user.id, key), buy(user.id, key)]);
  assert.equal(a.id, b.id);
  assert.equal(a.totalClp, 12345);
  assert.equal(
    (await client.product.findUniqueOrThrow({ where: { id: product.id } }))
      .stock,
    10,
  );
  await assert.rejects(checkout(user.id, 2, key, client), {
    code: "IDEMPOTENCY_CONFLICT",
  });
  await assert.rejects(buy(user.id), { code: "ORDER_PENDING" });
  await client.product.update({
    where: { id: product.id },
    data: { priceClp: 99999, name: "Nombre actualizado" },
  });
  await changeCart(user.id, 1, "set", product.id, 2, client);
  const final = await paid(user.id, a.payment!.id);
  assert.equal(final.status, "PAID");
  assert.equal(final.totalClp, 12345);
  assert.equal(final.items[0].name, "Producto aislado");
  assert.equal((await readCart(user.id, client)).items[0].quantity, 2);
  assert.equal((await buy(user.id, key)).id, a.id);
  await paid(user.id, a.payment!.id);
  assert.equal(
    (await client.product.findUniqueOrThrow({ where: { id: product.id } }))
      .stock,
    9,
  );
  const other = await buyer(product.id);
  await assert.rejects(readOrder(other.id, a.id, client), { status: 404 });
  await assert.rejects(paid(other.id, a.payment!.id), { status: 404 });
  assert.equal((await listOrders(other.id, 1, client)).items.length, 0);
});

test("validaciones: vacío, versión, stock y producto inactivo", async () => {
  const { user, product } = await fixture();
  await assert.rejects(checkout(user.id, 0, randomUUID(), client), {
    code: "CART_CONFLICT",
  });
  await client.product.update({
    where: { id: product.id },
    data: { stock: 0 },
  });
  await assert.rejects(buy(user.id), { code: "STOCK_CONFLICT" });
  await client.product.update({
    where: { id: product.id },
    data: { stock: 5, active: false },
  });
  await assert.rejects(buy(user.id), { code: "STOCK_CONFLICT" });
  await changeCart(user.id, 1, "remove", product.id, undefined, client);
  await assert.rejects(checkout(user.id, 2, randomUUID(), client), {
    code: "EMPTY_CART",
  });
});

test("última unidad: compras simultáneas, reversa y callback duplicado", async () => {
  const { user, product } = await fixture(1);
  const other = await buyer(product.id);
  const orders = await Promise.all([buy(user.id), buy(other.id)]);
  const results = await Promise.all(
    orders.map((o, i) => paid(i ? other.id : user.id, o.payment!.id)),
  );
  assert.deepEqual(results.map((o) => o.status).sort(), ["CANCELLED", "PAID"]);
  assert.equal(
    results.find((o) => o.status === "CANCELLED")!.payment!.status,
    "REVERSED",
  );
  assert.equal(
    (await client.product.findUniqueOrThrow({ where: { id: product.id } }))
      .stock,
    0,
  );
  await Promise.all(
    results.map((o, i) => paid(i ? other.id : user.id, o.payment!.id)),
  );
  assert.equal(
    (await client.product.findUniqueOrThrow({ where: { id: product.id } }))
      .stock,
    0,
  );
  const winner = results.find((o) => o.status === "PAID")!;
  assert.equal(
    (await readCart(winner.id === orders[0].id ? user.id : other.id, client))
      .items.length,
    0,
  );
});

test("aprobación duplicada en vuelo solo llama una vez al proveedor", async () => {
  const { user, product } = await fixture();
  const o = await buy(user.id);
  let calls = 0;
  const gateway: PaymentGateway = {
    ...simulatedGateway,
    async commit(p) {
      calls++;
      await new Promise((r) => setTimeout(r, 150));
      return simulatedGateway.commit(p);
    },
  };
  const results = await Promise.allSettled([
    processPayment(
      user.id,
      o.payment!.id,
      "commit",
      "approved",
      client,
      gateway,
    ),
    processPayment(
      user.id,
      o.payment!.id,
      "commit",
      "approved",
      client,
      gateway,
    ),
  ]);
  assert.equal(calls, 1);
  assert.equal(results.filter((r) => r.status === "fulfilled").length, 1);
  assert.equal(
    (await client.product.findUniqueOrThrow({ where: { id: product.id } }))
      .stock,
    9,
  );
});

test("rechazo, cancelación, timeout y recuperación con una conexión nueva", async () => {
  for (const scenario of [
    "rejected",
    "cancelled",
    "timeout",
    "timeout-approved",
  ] as const) {
    const { user, product } = await fixture();
    const o = await buy(user.id);
    const result = await processPayment(
      user.id,
      o.payment!.id,
      "commit",
      scenario,
      client,
    );
    assert.equal(
      result.payment!.status,
      scenario === "rejected"
        ? "REJECTED"
        : scenario === "cancelled"
          ? "CANCELLED"
          : "UNKNOWN",
    );
    assert.equal(
      (await client.product.findUniqueOrThrow({ where: { id: product.id } }))
        .stock,
      10,
    );
    const fresh = makeClient();
    try {
      const recovered = await processPayment(
        user.id,
        o.payment!.id,
        "reconcile",
        undefined,
        fresh,
      );
      assert.equal(
        recovered.status,
        scenario === "timeout-approved"
          ? "PAID"
          : scenario === "timeout"
            ? "PENDING"
            : scenario === "rejected"
              ? "FAILED"
              : "CANCELLED",
      );
      assert.equal(
        (await fresh.product.findUniqueOrThrow({ where: { id: product.id } }))
          .stock,
        scenario === "timeout-approved" ? 9 : 10,
      );
    } finally {
      await fresh.$disconnect();
    }
  }
});

test("reversas indeterminadas quedan en revisión y no se repiten", async () => {
  for (const scenario of ["reversal-failed", "reversal-timeout"] as const) {
    const { user, product } = await fixture();
    const o = await buy(user.id);
    await client.product.update({
      where: { id: product.id },
      data: { stock: 0 },
    });
    let refunds = 0;
    const gateway: PaymentGateway = {
      ...simulatedGateway,
      async refund(p) {
        refunds++;
        return simulatedGateway.refund(p);
      },
    };
    const result = await processPayment(
      user.id,
      o.payment!.id,
      "commit",
      scenario,
      client,
      gateway,
    );
    assert.equal(result.status, "REVIEW");
    assert.equal(result.payment!.status, "REVERSAL_PENDING");
    await processPayment(
      user.id,
      o.payment!.id,
      "commit",
      scenario,
      client,
      gateway,
    );
    assert.equal(refunds, 1);
    const confirmed: PaymentGateway = {
      ...gateway,
      async status(p) {
        return {
          state: "REVERSED",
          amount: p.amountClp,
          buyOrder: p.externalReference!,
          sessionId: p.sessionId!,
        };
      },
    };
    assert.equal(
      (
        await processPayment(
          user.id,
          o.payment!.id,
          "reconcile",
          undefined,
          client,
          confirmed,
        )
      ).payment!.status,
      "REVERSED",
    );
  }
});

test("Webpay aislado: verifica identidad, compensa stock y descarta datos de tarjeta", async () => {
  const { user, product } = await fixture();
  const o = await buy(user.id);
  await client.paymentAttempt.update({
    where: { id: o.payment!.id },
    data: {
      provider: "WEBPAY_INTEGRATION",
      tokenCipher: encryptToken("fixture-token-never-network"),
    },
  });
  const evidence = (p: PaymentInput) => ({
    state: "AUTHORIZED",
    code: 0,
    amount: p.amountClp,
    buyOrder: p.externalReference!,
    sessionId: p.sessionId!,
  });
  let refunds = 0;
  const wrong: PaymentGateway = {
    ...simulatedGateway,
    async commit(p) {
      return { ...evidence(p), amount: 1 };
    },
  };
  assert.equal(
    (
      await processPayment(
        user.id,
        o.payment!.id,
        "commit",
        undefined,
        client,
        wrong,
      )
    ).status,
    "REVIEW",
  );
  assert.equal(
    (await client.product.findUniqueOrThrow({ where: { id: product.id } }))
      .stock,
    10,
  );
  await client.product.update({
    where: { id: product.id },
    data: { stock: 0 },
  });
  const right: PaymentGateway = {
    ...wrong,
    async status(p) {
      return evidence(p);
    },
    async refund() {
      refunds++;
      return "NULLIFIED";
    },
  };
  assert.equal(
    (
      await processPayment(
        user.id,
        o.payment!.id,
        "reconcile",
        undefined,
        client,
        right,
      )
    ).payment!.status,
    "REVERSED",
  );
  assert.equal(refunds, 1);
  const row = await client.paymentAttempt.findUniqueOrThrow({
    where: { id: o.payment!.id },
  });
  assert.equal(row.reversalResult, "NULLIFIED");
  assert.ok(
    !JSON.stringify(await readOrder(user.id, o.id, client)).includes("token"),
  );
});

test("recupera un commit abandonado consultando estado, sin volver a commit", async () => {
  const { user } = await fixture();
  const o = await buy(user.id);
  await client.paymentAttempt.update({
    where: { id: o.payment!.id },
    data: {
      status: "PROCESSING",
      operation: "abandoned",
      operationAt: new Date(Date.now() - 60000),
      simulatedOutcome: "approved",
    },
  });
  let commits = 0;
  const gateway: PaymentGateway = {
    ...simulatedGateway,
    async commit(p) {
      commits++;
      return simulatedGateway.commit(p);
    },
  };
  assert.equal(
    (
      await processPayment(
        user.id,
        o.payment!.id,
        "reconcile",
        undefined,
        client,
        gateway,
      )
    ).status,
    "PAID",
  );
  assert.equal(commits, 0);
});

test("fallar una línea revierte el descuento de todas las demás", async () => {
  const { user, product } = await fixture();
  const second = await fixture();
  await changeCart(user.id, 1, "add", second.product.id, 1, client);
  const o = await checkout(user.id, 2, randomUUID(), client);
  // Fuerza el fallo en el último producto del orden de bloqueo, tras descontar el primero.
  const sorted = [product, second.product].sort((a, b) =>
    a.id.localeCompare(b.id),
  );
  await client.product.update({
    where: { id: sorted[1].id },
    data: { stock: 0 },
  });
  assert.equal(
    (await paid(user.id, o.payment!.id)).payment!.status,
    "REVERSED",
  );
  assert.equal(
    (await client.product.findUniqueOrThrow({ where: { id: sorted[0].id } }))
      .stock,
    10,
  );
});

test("create externo indeterminado no se reenvía y un proceso abandonado queda en revisión", async () => {
  const previous = process.env.PAYMENT_PROVIDER;
  process.env.PAYMENT_PROVIDER = "webpay_integration";
  try {
    const { user } = await fixture();
    let creates = 0;
    const key = randomUUID();
    const gateway: PaymentGateway = {
      ...simulatedGateway,
      async create() {
        creates++;
        throw new Error("Timeout externo sin token");
      },
    };
    const o = await checkout(user.id, 1, key, client, gateway);
    assert.equal(o.status, "REVIEW");
    await checkout(user.id, 1, key, client, gateway);
    assert.equal(creates, 1);
    await client.paymentAttempt.update({
      where: { id: o.payment!.id },
      data: {
        status: "PROCESSING",
        operation: "abandoned-create",
        operationAt: new Date(Date.now() - 60000),
      },
    });
    const result = await processPayment(
      user.id,
      o.payment!.id,
      "reconcile",
      undefined,
      client,
      gateway,
    );
    assert.equal(result.status, "REVIEW");
    assert.equal(result.payment!.status, "UNKNOWN");
    assert.equal(creates, 1);
  } finally {
    process.env.PAYMENT_PROVIDER = previous;
  }
});
