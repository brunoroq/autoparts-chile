import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { instrumentResponse } from "../src/lib/observability/request.ts";
import { ApiError } from "../src/lib/http/errors.ts";

test("instrumentación conserva redirect 303 inmutable y ejecuta la operación una vez", async () => {
  let calls = 0;
  const original = Response.redirect("http://localhost/pedidos/prueba", 303);
  // Es la operación exacta que ejecutaba la implementación anterior.
  assert.throws(() => original.headers.set("Cache-Control", "no-store"), {
    name: "TypeError", message: "immutable",
  });
  const response = await instrumentResponse("/fixture", "GET", async () => { calls++; return original; });
  assert.equal(calls, 1);
  assert.equal(response.status, 303);
  assert.equal(response.headers.get("Location"), original.headers.get("Location"));
  assert.equal(response.body, null);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
  assert.ok(response.headers.get("X-Request-Id"));
  assert.match(response.headers.get("Server-Timing")!, /app;dur=/);
  assert.equal(original.headers.has("Cache-Control"), false);
});

test("instrumentación conserva JSON, estado, cabeceras y cookies separadas", async () => {
  const cookies = ["first=fixture; Path=/; HttpOnly", "second=fixture; Expires=Wed, 18 Nov 2026 12:00:00 GMT; Path=/; SameSite=Lax"];
  const headers = new Headers({ "Content-Type": "application/json", "X-Fixture": "preserved", "Location": "/fixture", "Retry-After": "8" });
  for (const cookie of cookies) headers.append("Set-Cookie", cookie);
  const original = new Response(JSON.stringify({ data: "preserved" }), { status: 202, statusText: "Accepted fixture", headers });
  const response = await instrumentResponse("/fixture", "POST", async () => original);
  assert.equal(response.status, 202);
  assert.equal(response.statusText, "Accepted fixture");
  assert.deepEqual(await response.json(), { data: "preserved" });
  assert.deepEqual(response.headers.getSetCookie(), cookies);
  assert.equal(response.headers.get("X-Fixture"), "preserved");
  assert.equal(response.headers.get("Content-Type"), "application/json");
  assert.equal(response.headers.get("Location"), "/fixture");
  assert.equal(response.headers.get("Retry-After"), "8");
});

test("errores conocidos conservan Retry-After y los desconocidos se sanean", async () => {
  const limited = await instrumentResponse("/fixture", "POST", async () => { throw new ApiError("Espera", 429, "RATE_LIMIT", 7); });
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("Retry-After"), "7");
  assert.equal((await limited.json()).error.code, "RATE_LIMIT");
  const unknown = await instrumentResponse("/fixture", "GET", async () => { throw new Error("fixture-sensitive-detail"); });
  assert.equal(unknown.status, 500);
  assert.ok(!(await unknown.text()).includes("fixture-sensitive-detail"));
});

test("instrumentación conserva el cuerpo streaming sin consumirlo anticipadamente", async () => {
  const body = new ReadableStream({ start(controller) {
    controller.enqueue(new TextEncoder().encode("contenido de prueba"));
    controller.close();
  } });
  const response = await instrumentResponse("/fixture", "GET", async () => new Response(body));
  assert.equal(response.body, body);
  assert.equal(response.bodyUsed, false);
  assert.equal(await response.text(), "contenido de prueba");
});

test("respuestas 204 y 304 conservan cuerpo nulo, estado y cabeceras", async () => {
  for (const status of [204, 304]) {
    const response = await instrumentResponse("/fixture", "GET", async () => new Response(null, {
      status, headers: { ETag: '"fixture"', "X-Fixture": "preserved" },
    }));
    assert.equal(response.status, status);
    assert.equal(response.body, null);
    assert.equal(await response.text(), "");
    assert.equal(response.headers.get("ETag"), '"fixture"');
    assert.equal(response.headers.get("X-Fixture"), "preserved");
  }
});

test("callback real GET/POST con SDK y DB en memoria: 303 y aprobación idempotente", async (t) => {
  t.mock.method(globalThis, "fetch", () => { throw new Error("Red prohibida en prueba offline"); });
  const require = createRequire(import.meta.url);
  const { build } = createRequire(require.resolve("tsx/package.json"))("esbuild") as typeof import("esbuild");
  const fixture = path.resolve("tests/fixtures/webpay-return-memory.ts");
  const result = await build({
    entryPoints: ["tests/fixtures/webpay-return-harness.ts"], bundle: true,
    write: false, platform: "node", format: "esm", packages: "external",
    plugins: [{ name: "no-database-no-transbank", setup(builder) {
      builder.onResolve({ filter: /(?:db\/prisma|transbank-sdk)$/ }, () => ({ path: fixture }));
      // Prisma solo aporta tipos y un constructor de error para checkout, no usado aquí.
      builder.onResolve({ filter: /generated\/prisma\/client$/ }, () => ({ path: "prisma-types", namespace: "fixture" }));
      builder.onLoad({ filter: /.*/, namespace: "fixture" }, () => ({ contents: "export const Prisma = {};", loader: "js" }));
    } }],
  });
  const previous = { ...process.env };
  try {
    process.env.NEXTAUTH_URL = "http://127.0.0.1:3004";
    process.env.PAYMENT_PROVIDER = "webpay_integration";
    process.env.WEBPAY_ENVIRONMENT = "integration";
    delete process.env.VERCEL;
    const moduleUrl = pathToFileURL(path.resolve("tests/fixtures/webpay-return-harness.ts")).href;
    const code = result.outputFiles[0].text.replaceAll("import.meta.url", JSON.stringify(moduleUrl));
    for (const method of ["GET", "POST"]) {
    const harness = await import("data:text/javascript;base64," + Buffer.from(code).toString("base64") + "#" + method);
    const { responses, invalid, state } = await harness.exercise(method);
    for (const response of responses) {
      assert.equal(response.status, 303);
      assert.equal(response.headers.get("Location"), "http://127.0.0.1:3004/pedidos/order-fixture");
      assert.equal(response.headers.get("Cache-Control"), "no-store");
    }
    assert.equal(invalid.status, 400);
    assert.equal(state.commits, 1);
    assert.equal(state.statuses, 0);
    assert.equal(state.refunds, 0);
    assert.equal(state.order.status, "PAID");
    assert.equal(state.payment.status, "APPROVED");
    assert.equal(state.stock, 4);
    assert.equal(state.cartItems, 0);
    }
  } finally {
    for (const key of Object.keys(process.env)) if (!(key in previous)) delete process.env[key];
    Object.assign(process.env, previous);
  }
});
