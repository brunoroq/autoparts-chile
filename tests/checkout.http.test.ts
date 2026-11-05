import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import {
  authContext,
  testIdentity,
  register,
  login,
} from "./auth-http-helpers.ts";

test("HTTP checkout: sesión, CSRF, validaciones, idempotencia, aislamiento y confirmación", async () => {
  const a = await authContext("http://localhost:3004"),
    b = await authContext("http://localhost:3004"),
    guest = await authContext("http://localhost:3004");
  try {
    assert.equal(
      (
        await guest.post("/api/v1/checkout", {
          data: { cartVersion: 0 },
          headers: { "Idempotency-Key": randomUUID() },
        })
      ).status(),
      401,
    );
    assert.equal((await guest.get("/api/v1/orders")).status(), 401);
    const ia = testIdentity(),
      ib = testIdentity();
    await register(a, ia);
    await login(a, ia);
    await register(b, ib);
    await login(b, ib);
    assert.equal(
      (
        await a.post("/api/v1/checkout", {
          data: { cartVersion: 0 },
          headers: { Origin: "https://untrusted.invalid" },
        })
      ).status(),
      403,
    );
    assert.equal(
      (await a.post("/api/v1/checkout", { data: { cartVersion: 0 } })).status(),
      400,
    );
    const products = await (await a.get("/api/v1/products?pageSize=12")).json();
    const product =
      products.data.find((p: { stock: number }) => p.stock > 0) ??
      products.data[0];
    assert.ok(product.id);
    const add = await a.post("/api/v1/cart/items", {
      data: { productId: product.id, quantity: 1 },
      headers: { "If-Match": '"0"' },
    });
    assert.equal(add.status(), 201);
    const cart = (await add.json()).data;
    const key = randomUUID(),
      headers = { "Idempotency-Key": key };
    assert.equal(
      (
        await a.post("/api/v1/checkout", {
          data: { cartVersion: cart.version, totalClp: 1 },
          headers,
        })
      ).status(),
      400,
    );
    const response = await a.post("/api/v1/checkout", {
      data: { cartVersion: cart.version },
      headers,
    });
    assert.equal(response.status(), 200);
    assert.match(response.headers()["server-timing"], /provider;dur=/);
    assert.equal(response.headers()["cache-control"], "no-store");
    const order = (await response.json()).data;
    assert.equal(
      (
        await (
          await a.post("/api/v1/checkout", {
            data: { cartVersion: cart.version },
            headers,
          })
        ).json()
      ).data.id,
      order.id,
    );
    assert.equal((await b.get("/api/v1/orders/" + order.id)).status(), 404);
    assert.equal(
      (
        await b.post("/api/v1/payments/" + order.payment.id + "/simulate", {
          data: { scenario: "approved" },
        })
      ).status(),
      404,
    );
    assert.equal(
      (await b.post("/api/v1/orders/" + order.id + "/reconcile")).status(),
      404,
    );
    assert.equal(
      (
        await a.post("/api/v1/payments/" + order.payment.id + "/simulate", {
          data: { scenario: "forged" },
        })
      ).status(),
      400,
    );
    const pay = () =>
      a.post("/api/v1/payments/" + order.payment.id + "/simulate", {
        data: { scenario: "approved" },
      });
    const result = (await (await pay()).json()).data;
    assert.equal(result.status, "PAID");
    assert.equal((await (await pay()).json()).data.status, "PAID");
    assert.equal(
      (await (await a.get("/api/v1/cart")).json()).data.items.length,
      0,
    );
    assert.equal(
      (await (await a.get("/api/v1/orders")).json()).data.items[0].id,
      order.id,
    );
    assert.equal((await a.get("/api/v1/orders?page=0")).status(), 400);
    assert.equal(
      (
        await guest.get("/api/v1/payments/webpay/return?token_ws=invalid")
      ).status(),
      400,
    );
  } finally {
    await a.dispose();
    await b.dispose();
    await guest.dispose();
  }
});
