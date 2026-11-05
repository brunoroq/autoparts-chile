import { request, type APIRequestContext } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
import assert from "node:assert/strict";

export const AUTH_BASE = "http://localhost:3002";
export const testIdentity = () => ({
  name: "Persona de prueba",
  email: `${randomUUID()}@example.invalid`,
  password: randomBytes(20).toString("hex"),
});
export const authContext = (base = AUTH_BASE) =>
  request.newContext({ baseURL: base, extraHTTPHeaders: { Origin: base } });
export async function register(
  context: APIRequestContext,
  identity: ReturnType<typeof testIdentity>,
) {
  const response = await context.post("/api/v1/users", {
    data: { ...identity, confirmPassword: identity.password },
  });
  assert.equal(response.status(), 201);
  const body = await response.json();
  assert.ok(!JSON.stringify(body).includes(identity.password));
  assert.ok(!("passwordHash" in body.data));
  return body.data;
}
export async function login(
  context: APIRequestContext,
  identity: { email: string; password: string },
) {
  const csrf = await (await context.get("/api/auth/csrf")).json();
  return context.post("/api/auth/callback/credentials", {
    form: {
      ...identity,
      csrfToken: csrf.csrfToken,
      callbackUrl: "/carrito",
      json: "true",
    },
  });
}
export async function logout(context: APIRequestContext) {
  const csrf = await (await context.get("/api/auth/csrf")).json();
  const response = await context.post("/api/auth/signout", {
    form: { csrfToken: csrf.csrfToken, callbackUrl: "/", json: "true" },
  });
  assert.equal(response.status(), 200);
}
