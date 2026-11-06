import test from "node:test";
import assert from "node:assert/strict";
import { hashPassword, verifyPassword } from "../src/lib/auth/password.ts";
import { randomBytes } from "node:crypto";
import {
  registrationInput,
  normalizeEmail,
} from "../src/modules/users/validation.ts";
import { AttemptLimiter } from "../src/lib/auth/rate-limit.ts";
import { cartVersion, cartBody } from "../src/modules/cart/validation.ts";
import {
  safeReturnPath,
  readJson,
  checkOrigin,
} from "../src/lib/http/input.ts";

test("scrypt con sal aleatoria, verificación y formatos acotados", async () => {
  const password = randomBytes(20).toString("hex");
  const a = await hashPassword(password),
    b = await hashPassword(password);
  assert.notEqual(a, b);
  assert.ok(!a.includes(password));
  assert.match(a, /^scrypt\$v1\$131072\$8\$1\$/);
  assert.equal(await verifyPassword(password, a), true);
  assert.equal(await verifyPassword(password + "x", a), false);
  assert.equal(await verifyPassword(password, null), false);
  assert.equal(
    await verifyPassword(password, a.replace("131072", "999999999")),
    false,
  );
});
test("registro normaliza correo y rechaza entradas manipuladas", () => {
  const body = {
    name: "Persona de prueba",
    email: " Persona@Example.invalid ",
    password: "solo-para-validar-formato",
    confirmPassword: "solo-para-validar-formato",
  };
  assert.equal(registrationInput(body).email, "persona@example.invalid");
  for (const changed of [
    { ...body, userId: "otro" },
    { ...body, name: "a" },
    { ...body, confirmPassword: "distinta" },
    { ...body, password: "corta" },
  ])
    assert.throws(() => registrationInput(changed));
  assert.throws(() => normalizeEmail("no-es-correo"));
});
test("límites expiran y no conservan memoria ilimitada", () => {
  let now = 0;
  const limiter = new AttemptLimiter(2, () => now);
  limiter.take("a", 1, 1000);
  assert.throws(() => limiter.take("a", 1, 1000), { status: 429 });
  now = 1001;
  assert.doesNotThrow(() => limiter.take("a", 1, 1000));
  limiter.take("b", 1);
  assert.throws(() => limiter.take("c", 1), { status: 429 });
});
test("cantidades y precondiciones del carrito", () => {
  assert.equal(cartVersion('"0"'), 0);
  assert.equal(cartVersion('"42"'), 42);
  assert.throws(() => cartVersion(null), { status: 428 });
  for (const version of ["0", '"-1"', 'W/"1"', '"2147483647"'])
    assert.throws(() => cartVersion(version));
  for (const quantity of [0, -1, 1.5, 100, "2"])
    assert.throws(() => cartBody({ quantity }, false));
  assert.throws(() => cartBody({ quantity: 1, priceClp: 1 }, false));
});
test("retornos locales, origen y JSON seguro", async () => {
  assert.equal(safeReturnPath("https://otro.invalid"), "/carrito");
  assert.equal(safeReturnPath("//otro.invalid"), "/carrito");
  assert.equal(safeReturnPath("/productos/led?q=1"), "/productos/led?q=1");
  process.env.NEXTAUTH_URL = "http://localhost:3000";
  assert.throws(
    () =>
      checkOrigin(
        new Request("http://localhost:3000", {
          method: "POST",
          headers: { origin: "https://otro.invalid" },
        }),
      ),
    { status: 403 },
  );
  await assert.rejects(
    readJson(
      new Request("http://localhost:3000", {
        method: "POST",
        body: "[]",
        headers: { "content-type": "application/json" },
      }),
    ),
    { status: 400 },
  );
  await assert.rejects(
    readJson(
      new Request("http://localhost:3000", {
        method: "POST",
        body: "a".repeat(9000),
        headers: { "content-type": "application/json" },
      }),
    ),
    { status: 413 },
  );
});
