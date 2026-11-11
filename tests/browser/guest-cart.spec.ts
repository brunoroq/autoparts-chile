import { test, expect } from "@playwright/test";
import { randomUUID, randomBytes } from "node:crypto";
import { authContext, register, login, testIdentity } from "../auth-http-helpers";

test.use({ baseURL: "http://localhost:3012" });
test("invitado agrega, recarga, modifica y elimina sin login ni errores de hidratación", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto("/productos/kit-de-ampolletas-led-h7");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByRole("status")).toContainText("Accesorio agregado");
  await page.getByRole("link", { name: "Ver carrito" }).click();
  await expect(page).toHaveURL(/\/carrito$/);
  await expect(page.locator(".cart-row")).toHaveCount(1);
  await page.reload();
  await expect(page.locator(".cart-row")).toHaveCount(1);
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Cantidad actualizada");
  await page.reload();
  await expect(page.getByLabel("Cantidad", { exact: true })).toHaveValue("2");
  await page.getByRole("link", { name: /Iniciar sesión para pagar/ }).click();
  await expect(page).toHaveURL(/iniciar-sesion.*callbackUrl=%2Fcheckout/);
  await page.goto("/carrito");
  await page.getByRole("button", { name: /Eliminar Kit/ }).click();
  await expect(page.getByRole("heading", { name: "Tu carrito está vacío." })).toBeVisible();
  await page.reload();
  await expect(page.locator(".cart-row")).toHaveCount(0);
  expect(errors).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("cotización pública rechaza precios enviados por cliente y no permite origen externo", async ({ request }) => {
  const response = await request.get("/api/v1/products");
  const product = (await response.json()).data[0];
  const valid = await request.post("/api/v1/cart/guest", { headers: { Origin: "http://localhost:3012" }, data: { items: [{ productId: product.id, quantity: 2 }] } });
  expect(valid.status()).toBe(200);
  expect((await valid.json()).data.totalClp).toBe(product.priceClp * 2);
  expect(valid.headers()["cache-control"]).toBe("no-store");
  expect(valid.headers()["server-timing"]).toContain("db;dur=");
  expect((await request.post("/api/v1/cart/guest", { headers: { Origin: "https://external.invalid" }, data: { items: [] } })).status()).toBe(403);
  expect((await request.post("/api/v1/cart/guest", { headers: { Origin: "http://localhost:3012" }, data: { items: [{ productId: product.id, quantity: 1, priceClp: 1 }] } })).status()).toBe(400);
});

test("login fusiona carrito de cuenta y recupera respuesta perdida sin sumar dos veces", async ({ page }) => {
  const api = await authContext("http://localhost:3012"), identity = testIdentity();
  try {
    await register(api, identity); await login(api, identity);
    const product = (await (await api.get("/api/v1/products?pageSize=50")).json()).data.find((p: { stock: number }) => p.stock >= 5);
    expect((await api.post("/api/v1/cart/items", { headers: { "If-Match": '"0"' }, data: { productId: product.id, quantity: 1 } })).status()).toBe(201);
    await page.goto(`/productos/${product.slug}`);
    await page.getByLabel("Cantidad", { exact: true }).fill("2");
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(page.getByRole("status")).toContainText("Accesorio agregado");
    const attempts: string[] = [];
    await page.route("**/api/v1/cart/merge", async route => {
      attempts.push(route.request().postDataJSON().mergeId);
      if (attempts.length === 1) {
        const response = await route.fetch(); expect(response.status()).toBe(200);
        await route.abort("connectionfailed");
      } else await route.continue();
    });
    await page.goto("/iniciar-sesion?callbackUrl=%2Fcarrito");
    await page.getByLabel("Correo electrónico").fill(identity.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(identity.password);
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await expect(page.locator(".cart-row")).toHaveCount(1);
    await expect(page.getByLabel("Cantidad", { exact: true })).toHaveValue("3");
    expect(attempts.length).toBeGreaterThanOrEqual(2);
    expect(new Set(attempts).size).toBe(1);
    await page.reload();
    await expect(page.getByLabel("Cantidad", { exact: true })).toHaveValue("3");
    expect(await page.evaluate(() => JSON.parse(localStorage.getItem("autoparts:guest-cart:v1")!).items)).toEqual([]);
    await page.getByRole("button", { name: "Salir", exact: true }).click();
    await expect(page.getByRole("link", { name: "Ingresar", exact: true })).toBeVisible();
    await page.goto("/carrito");
    await expect(page.locator(".cart-row")).toHaveCount(0);
    expect((await (await api.get("/api/v1/cart")).json()).data.items[0].quantity).toBe(3);
  } finally { await api.dispose(); }
});

test("registro autentica, fusiona y continúa al checkout protegido", async ({ page }) => {
  await page.goto("/productos/kit-de-ampolletas-led-h7");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByRole("status")).toContainText("Accesorio agregado");
  await page.goto("/registro?callbackUrl=%2Fcheckout");
  const password = randomBytes(20).toString("hex");
  await page.getByLabel("Nombre", { exact: true }).fill("Invitado de prueba");
  await page.getByLabel("Correo electrónico").fill(`${randomUUID()}@example.invalid`);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Confirmar contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page).toHaveURL(/\/checkout$/);
  await expect(page.getByRole("heading", { name: "Revisa tu compra." })).toBeVisible();
  const cart = await (await page.request.get("/api/v1/cart")).json();
  expect(cart.data.items).toHaveLength(1);
  expect(cart.data.items[0].quantity).toBe(1);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Revisa tu compra." })).toBeVisible();
  expect((await (await page.request.get("/api/v1/cart")).json()).data.items[0].quantity).toBe(1);
});

test("dos pestañas agregan al mismo carrito invitado sin perder cantidades", async ({ page, context }) => {
  const second = await context.newPage();
  await Promise.all([page.goto("/productos/kit-de-ampolletas-led-h7"), second.goto("/productos/kit-de-ampolletas-led-h7")]);
  await Promise.all([page.getByRole("button", { name: "Agregar al carrito" }).click(), second.getByRole("button", { name: "Agregar al carrito" }).click()]);
  await expect(page.getByRole("status")).toContainText("Accesorio agregado");
  await expect(second.getByRole("status")).toContainText("Accesorio agregado");
  await page.goto("/carrito");
  await expect(page.getByLabel("Cantidad", { exact: true })).toHaveValue("2");
});

test("conflicto de stock conserva invitado y cuenta; permite corregir y reintentar", async ({ page }) => {
  const api = await authContext("http://localhost:3012"), identity = testIdentity();
  try {
    await register(api, identity); await login(api, identity);
    const products = (await (await api.get("/api/v1/products?pageSize=50")).json()).data;
    const product = products.find((p: { stock: number }) => p.stock >= 1 && p.stock <= 99);
    expect((await api.post("/api/v1/cart/items", { headers: { "If-Match": '"0"' }, data: { productId: product.id, quantity: product.stock } })).status()).toBe(201);
    await page.goto(`/productos/${product.slug}`);
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(page.getByRole("status")).toContainText("Accesorio agregado");
    await page.goto("/iniciar-sesion");
    await page.getByLabel("Correo electrónico").fill(identity.email);
    await page.getByLabel("Contraseña", { exact: true }).fill(identity.password);
    await page.getByRole("button", { name: "Iniciar sesión", exact: true }).click();
    await expect(page.locator(".cart-page [role=alert]")).toContainText("supera el stock");
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("autoparts:guest-cart:v1")!));
    expect(stored.items[0].quantity).toBe(1);
    expect(stored.pending).toBeUndefined();
    expect((await (await api.get("/api/v1/cart")).json()).data.items[0].quantity).toBe(product.stock);
    await page.getByRole("button", { name: /^Eliminar / }).click();
    await expect(page.locator(".cart-row")).toHaveCount(0);
    await page.getByRole("button", { name: "Volver a intentar", exact: true }).click();
    await expect(page.getByLabel("Cantidad", { exact: true })).toHaveValue(String(product.stock));
    await expect(page.locator(".cart-page [role=alert]")).toHaveCount(0);
  } finally { await api.dispose(); }
});
