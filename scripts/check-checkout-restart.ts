import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { authTestSecret } from "../tests/auth-database.ts";
import { checkoutTestUrl } from "../tests/checkout-database.ts";
import { randomUUID } from "node:crypto";
import {
  authContext,
  testIdentity,
  register,
  login,
  logout,
} from "../tests/auth-http-helpers.ts";

const base = "http://localhost:3105";
let server: ChildProcess | undefined;
let output = "";
async function start() {
  server = spawn(
    process.execPath,
    [
      "node_modules/next/dist/bin/next",
      "start",
      "--hostname",
      "127.0.0.1",
      "--port",
      "3105",
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: checkoutTestUrl(),
        NEXTAUTH_SECRET: authTestSecret(),
        NEXTAUTH_URL: base,
        PAYMENT_PROVIDER: "simulated",
        WEBPAY_ENVIRONMENT: "integration",
      },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  server.stdout?.on("data", (data) => {
    output += String(data);
  });
  server.stderr?.on("data", (data) => {
    output += String(data);
  });
  for (let i = 0; i < 60; i++) {
    try {
      if ((await fetch(`${base}/api/auth/providers`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error("No inició el servidor aislado para persistencia.");
}
async function stop() {
  if (server && server.exitCode === null) {
    const ended = once(server, "exit");
    server.kill();
    await ended;
  }
  server = undefined;
}
const context = await authContext(base);
const identity = testIdentity();
const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: checkoutTestUrl() }),
});
try {
  await start();
  const user = await register(context, identity);
  await login(context, identity);
  const category = await db.category.findFirstOrThrow();
  const fixture = randomUUID();
  const product = await db.product.create({
    data: {
      sku: fixture,
      slug: fixture,
      name: "Prueba de reinicio",
      description: "Fixture aislado",
      categoryId: category.id,
      priceClp: 12345,
      stock: 3,
    },
  });
  const id = product.id;
  const saved = await context.post("/api/v1/cart/items", {
    headers: { "If-Match": '"0"' },
    data: { productId: id, quantity: 2 },
  });
  assert.equal(saved.status(), 201);
  const cart = (await saved.json()).data;
  const create = await context.post("/api/v1/checkout", {
    headers: { "Idempotency-Key": randomUUID() },
    data: { cartVersion: cart.version },
  });
  assert.equal(create.status(), 200);
  const order = (await create.json()).data;
  const simulated = await context.post(
    "/api/v1/payments/" + order.payment.id + "/simulate",
    { data: { scenario: "timeout-approved" } },
  );
  assert.equal((await simulated.json()).data.payment.status, "UNKNOWN");
  const state = await context.storageState();
  const sessionToken = state.cookies.find((cookie) =>
    cookie.name.endsWith("session-token"),
  )?.value;
  assert.ok(sessionToken);
  const csrf = await (await context.get("/api/auth/csrf")).json();
  const stored = await db.user.findUniqueOrThrow({
    where: { id: user.id },
    select: { passwordHash: true },
  });
  assert.ok(stored.passwordHash);
  await stop();
  await start();
  const recovered = await context.post(
    "/api/v1/orders/" + order.id + "/reconcile",
  );
  assert.equal(recovered.status(), 200);
  assert.equal((await recovered.json()).data.status, "PAID");
  await logout(context);
  await login(context, identity);
  assert.equal(
    (await (await context.get("/api/v1/orders/" + order.id)).json()).data
      .status,
    "PAID",
  );
  assert.equal(
    (await (await context.get("/api/v1/cart")).json()).data.items.length,
    0,
  );
  for (const secret of [
    identity.password,
    stored.passwordHash,
    sessionToken,
    csrf.csrfToken,
    authTestSecret(),
  ])
    assert.ok(!output.includes(secret), "Los logs no deben contener secretos.");
  assert.match(output, /"authMs":/);
  assert.match(output, /"hashMs":/);
  assert.match(output, /"providerMs":/);
  assert.match(output, /"dbMs":/);
  console.log(
    "Pedido indeterminado recuperado tras reiniciar proceso y logout/login; logs sin secretos conocidos.",
  );
} finally {
  await stop();
  await context.dispose();
  await db.$disconnect();
}
