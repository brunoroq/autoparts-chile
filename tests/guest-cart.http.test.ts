import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { authContext, testIdentity, register, login } from "./auth-http-helpers";

test("HTTP: fusión protegida, idempotencia y rechazo de precios/identidad del cliente", async () => {
  const api = await authContext(), other = await authContext();
  try {
    assert.equal((await api.post("/api/v1/cart/merge", { data: { mergeId: randomUUID(), items: [] } })).status(), 401);
    const product = (await (await api.get("/api/v1/products?pageSize=50")).json()).data.find((p: { stock: number }) => p.stock >= 3);
    assert.ok(product);
    const input = { mergeId: randomUUID(), items: [{ productId: product.id, quantity: 2 }] };
    const account = testIdentity();
    await register(api, account); await login(api, account);
    const noOrigin = await request.newContext({ baseURL: "http://localhost:3002", storageState: await api.storageState() });
    try {
      // Los GET autenticados legítimos no necesitan Origin ni un token CSRF.
      assert.equal((await noOrigin.get("/api/v1/cart")).status(), 200);
      assert.equal((await noOrigin.post("/api/v1/cart/guest", { data: { items: [] } })).status(), 403);
      assert.equal((await noOrigin.post("/api/v1/cart/merge", { data: input })).status(), 403);
    } finally { await noOrigin.dispose(); }
    assert.equal((await api.post("/api/v1/cart/guest", { data: { items: [] }, headers: { Host: "evil.invalid" } })).status(), 403);
    const quote = await api.post("/api/v1/cart/guest", { data: { items: input.items } });
    assert.equal(quote.status(), 200);
    assert.equal((await quote.json()).data.totalClp, product.priceClp * 2);
    assert.equal((await api.post("/api/v1/cart/merge", { data: input, headers: { Origin: "https://external.invalid" } })).status(), 403);
    assert.equal((await api.post("/api/v1/cart/merge", { data: { ...input, userId: randomUUID() } })).status(), 400);
    assert.equal((await api.post("/api/v1/cart/merge", { data: { ...input, items: [{ productId: product.id, quantity: 1, priceClp: 1 }] } })).status(), 400);
    for (let n = 0; n < 2; n++) {
      const response = await api.post("/api/v1/cart/merge", { data: input });
      assert.equal(response.status(), 200);
      assert.equal(response.headers()["cache-control"], "no-store");
      assert.ok(response.headers()["server-timing"].includes("db;dur="));
      const result = await response.json();
      assert.equal(result.data.items[0].quantity, 2);
      assert.equal(result.data.totalClp, 2 * product.priceClp);
      assert.equal(result.analytics, undefined);
    }
    assert.equal((await api.post("/api/v1/cart/merge", { data: { ...input, items: [{ productId: product.id, quantity: 1 }] } })).status(), 409);
    const second = testIdentity(); await register(other, second); await login(other, second);
    assert.equal((await other.post("/api/v1/cart/merge", { data: input })).status(), 409);
    assert.equal((await (await other.get("/api/v1/cart")).json()).data.items.length, 0);
  } finally { await api.dispose(); await other.dispose(); }
});
