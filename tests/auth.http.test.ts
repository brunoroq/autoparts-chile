import test from "node:test";
import assert from "node:assert/strict";
import { encode } from "next-auth/jwt";
import { authTestSecret } from "./auth-database.ts";
import {
  AUTH_BASE,
  authContext,
  testIdentity,
  register,
  login,
  logout,
} from "./auth-http-helpers.ts";

test("registro, Credentials, cookies, logout/login y carrito persistente por HTTP", async () => {
  const context = await authContext();
  const identity = testIdentity();
  try {
    assert.equal((await context.get("/api/v1/cart")).status(), 401);
    assert.equal((await context.post("/api/v1/cart/items", { data: { quantity: 1 } })).status(), 401);
    for (const method of ["patch", "delete"] as const) assert.equal((await context[method]("/api/v1/cart/items/00000000-0000-5000-a000-000000000000", { data: { quantity: 1 } })).status(), 401);
    const account = await register(context, identity);
    assert.equal(
      (
        await context.post("/api/v1/users", {
          data: { ...identity, confirmPassword: identity.password },
        })
      ).status(),
      409,
    );
    assert.equal(
      (
        await login(context, { ...identity, password: identity.password + "x" })
      ).status(),
      401,
    );
    const signed = await login(context, identity);
    assert.equal(signed.status(), 200);
    assert.ok(
      signed
        .headersArray()
        .some(
          (h) =>
            h.name.toLowerCase() === "set-cookie" &&
            h.value.startsWith("next-auth.session-token=") &&
            /HttpOnly/i.test(h.value) &&
            /SameSite=Lax/i.test(h.value),
        ),
    );
    const session = await (await context.get("/api/auth/session")).json();
    assert.equal(session.user.id, account.id);
    assert.ok(!JSON.stringify(session).includes(identity.password));
    const products = await (await context.get("/api/v1/products")).json();
    const product = products.data[0];
    const added = await context.post("/api/v1/cart/items", {
      headers: { "If-Match": '"0"' },
      data: { productId: product.id, quantity: 1 },
    });
    assert.equal(added.status(), 201);
    assert.equal(added.headers()["cache-control"], "no-store");
    assert.ok(added.headers()["server-timing"].includes("auth;dur="));
    assert.equal((await added.json()).data.totalClp, product.priceClp);
    await logout(context);
    assert.equal((await context.get("/api/v1/cart")).status(), 401);
    assert.equal((await login(context, identity)).status(), 200);
    const saved = await (await context.get("/api/v1/cart")).json();
    assert.equal(saved.data.items[0].productId, product.id);
    assert.equal(saved.data.version, 1);
    assert.equal(
      (await context.get("/carrito", { maxRedirects: 0 })).status(),
      200,
    );
  } finally {
    await context.dispose();
  }
});

test("aislamiento y dos mutaciones HTTP con misma versión: una gana y otra 409", async () => {
  const a = await authContext(),
    b = await authContext();
  const ia = testIdentity(),
    ib = testIdentity();
  try {
    await register(a, ia);
    await register(b, ib);
    await login(a, ia);
    await login(b, ib);
    const products = await (await a.get("/api/v1/products")).json();
    const id = products.data[0].id;
    await b.post("/api/v1/cart/items", {
      headers: { "If-Match": '"0"' },
      data: { productId: id, quantity: 1 },
    });
    assert.equal(
      (
        await a.delete(`/api/v1/cart/items/${id}`, {
          headers: { "If-Match": '"0"' },
        })
      ).status(),
      404,
    );
    const results = await Promise.all([
      a.post("/api/v1/cart/items", {
        headers: { "If-Match": '"0"' },
        data: { productId: id, quantity: 1 },
      }),
      a.post("/api/v1/cart/items", {
        headers: { "If-Match": '"0"' },
        data: { productId: id, quantity: 1 },
      }),
    ]);
    assert.deepEqual(results.map((r) => r.status()).sort(), [201, 409]);
    assert.equal(
      (await (await a.get("/api/v1/cart")).json()).data.items[0].quantity,
      1,
    );
    for (const quantity of [0, -1, 1.5, 100, "2"])
      assert.equal(
        (
          await a.patch(`/api/v1/cart/items/${id}`, {
            headers: { "If-Match": '"1"' },
            data: { quantity },
          })
        ).status(),
        400,
      );
    assert.equal(
      (
        await a.patch(`/api/v1/cart/items/${id}`, {
          headers: { "If-Match": '"1"' },
          data: { quantity: 99 },
        })
      ).status(),
      409,
    );
    assert.equal(
      (
        await a.patch(`/api/v1/cart/items/${id}`, { data: { quantity: 2 } })
      ).status(),
      428,
    );
    assert.equal(
      (
        await a.patch(`/api/v1/cart/items/${id}`, {
          headers: { "If-Match": '"1"' },
          data: { quantity: 1, priceClp: 1, userId: "otro" },
        })
      ).status(),
      400,
    );
    assert.equal(
      (
        await a.patch(`/api/v1/cart/items/${id}`, {
          headers: { "If-Match": '"1"', Origin: "https://evil.invalid" },
          data: { quantity: 1 },
        })
      ).status(),
      403,
    );
    assert.equal(
      (
        await a.patch(`/api/v1/cart/items/${id}`, {
          headers: { "If-Match": '"1"' },
          data: { quantity: 2 },
        })
      ).status(),
      200,
    );
    assert.equal(
      (await (await b.get("/api/v1/cart")).json()).data.items[0].quantity,
      1,
    );
    assert.equal(
      (
        await a.delete(`/api/v1/cart/items/${id}`, {
          headers: { "If-Match": '"2"' },
        })
      ).status(),
      200,
    );
    assert.equal(
      (await (await a.get("/api/v1/cart")).json()).data.items.length,
      0,
    );
  } finally {
    await a.dispose();
    await b.dispose();
  }
});

test("CSRF, sesión manipulada/expirada, origen y retorno externo", async () => {
  const context = await authContext();
  const identity = testIdentity();
  try {
    const missingCsrf = await context.post("/api/auth/callback/credentials", {
      form: { ...identity, json: "true" },
    });
    assert.ok((await missingCsrf.json()).url.includes("csrf=true"));
    assert.equal((await context.get("/api/v1/cart")).status(), 401);
    assert.equal(
      (
        await context.post("/api/v1/users", {
          headers: { Origin: "https://evil.invalid" },
          data: { ...identity, confirmPassword: identity.password },
        })
      ).status(),
      403,
    );
    const account = await register(context, identity);
    const expired = await encode({
      secret: authTestSecret(),
      token: { sub: account.id },
      maxAge: -120,
    });
    for (const token of ["invalid-cookie", expired]) {
      const response = await context.get("/api/v1/cart", {
        headers: { Cookie: `next-auth.session-token=${token}` },
      });
      assert.equal(response.status(), 401);
    }
    const csrf = await (await context.get("/api/auth/csrf")).json();
    const response = await context.post("/api/auth/callback/credentials", {
      form: {
        ...identity,
        csrfToken: csrf.csrfToken,
        callbackUrl: "https://evil.invalid",
        json: "true",
      },
    });
    assert.equal(new URL((await response.json()).url).origin, AUTH_BASE);
  } finally {
    await context.dispose();
  }
});

test("intentos repetidos de login devuelven 429 y Retry-After sin datos sensibles", async () => {
  const context = await authContext();
  const identity = testIdentity();
  try {
    for (let i = 0; i < 10; i++)
      assert.equal((await login(context, identity)).status(), 401);
    const limited = await login(context, identity);
    assert.equal(limited.status(), 429);
    assert.ok(Number(limited.headers()["retry-after"]) > 0);
    assert.ok((await limited.json()).url.includes("RateLimited"));
  } finally {
    await context.dispose();
  }
});
