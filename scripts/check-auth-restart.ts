import { spawn, type ChildProcess } from "node:child_process";
import { once } from "node:events";
import assert from "node:assert/strict";
import { PrismaClient } from "../src/generated/prisma/client.ts";
import { PrismaPg } from "@prisma/adapter-pg";
import { authTestSecret, authTestUrl } from "../tests/auth-database.ts";
import {
  authContext,
  testIdentity,
  register,
  login,
  logout,
} from "../tests/auth-http-helpers.ts";

const base = "http://localhost:3104";
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
      "3104",
    ],
    {
      env: {
        ...process.env,
        DATABASE_URL: authTestUrl(),
        NEXTAUTH_SECRET: authTestSecret(),
        NEXTAUTH_URL: base,
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
  adapter: new PrismaPg({ connectionString: authTestUrl() }),
});
try {
  await start();
  const user = await register(context, identity);
  await login(context, identity);
  const products = await (await context.get("/api/v1/products")).json();
  const id = products.data[0].id;
  const saved = await context.post("/api/v1/cart/items", {
    headers: { "If-Match": '"0"' },
    data: { productId: id, quantity: 2 },
  });
  assert.equal(saved.status(), 201);
  const expected = (await saved.json()).data;
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
  assert.deepEqual(
    (await (await context.get("/api/v1/cart")).json()).data,
    expected,
  );
  await logout(context);
  assert.equal((await context.get("/api/v1/cart")).status(), 401);
  await login(context, identity);
  assert.deepEqual(
    (await (await context.get("/api/v1/cart")).json()).data,
    expected,
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
  assert.match(output, /"dbMs":/);
  console.log(
    "Persistencia tras reiniciar proceso y logout/login correcta; logs capturados sin contraseña, hash, cookie, CSRF ni secreto.",
  );
} finally {
  await stop();
  await context.dispose();
  await db.$disconnect();
}
