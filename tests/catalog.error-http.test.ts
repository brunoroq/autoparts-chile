import test from "node:test";
import assert from "node:assert/strict";

test("servidor aislado con base inaccesible devuelve 500 sin filtrar conexión", async () => {
  const response = await fetch("http://localhost:3001/api/v1/products", {
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(response.status, 500);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const text = await response.text();
  assert.ok(!/postgresql:|unused|65432|Prisma/.test(text));
  const body = JSON.parse(text);
  assert.equal(body.error.code, "INTERNAL_ERROR");
  assert.equal(body.error.requestId, response.headers.get("x-request-id"));
  assert.ok(response.headers.get("server-timing")?.includes("db;dur="));
});
