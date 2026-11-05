import { test, expect } from "@playwright/test";
import { randomBytes, randomUUID } from "node:crypto";
test.use({ baseURL: "http://localhost:3002" });

test("registro, login, carrito, logout y persistencia con teclado", async ({
  page,
}) => {
  const email = `${randomUUID()}@example.invalid`;
  const password = randomBytes(20).toString("hex");
  await page.goto("/carrito");
  await expect(page).toHaveURL(/iniciar-sesion/);
  await page.getByRole("link", { name: "Crea tu cuenta", exact: true }).click();
  await page.getByLabel("Nombre", { exact: true }).fill("Persona de prueba");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Confirmar contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Cuenta creada");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByLabel("Contraseña", { exact: true }).press("Enter");
  await expect(page).toHaveURL(/\/carrito$/);
  await expect(
    page.getByRole("heading", { name: "Tu carrito está vacío." }),
  ).toBeVisible();
  await page.goto("/productos/kit-de-ampolletas-led-h7");
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByRole("status")).toContainText("Accesorio agregado");
  await page.getByRole("link", { name: "Ver carrito →" }).click();
  await expect(page.locator(".cart-row")).toHaveCount(1);
  await page.getByLabel("Cantidad", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Cantidad actualizada");
  await expect(page.locator(".cart-total")).toContainText("$74.970");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/cart-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "Salir", exact: true }).click();
  await expect(
    page.getByRole("link", { name: "Ingresar", exact: true }),
  ).toBeVisible();
  await page.goto("/carrito");
  await expect(page).toHaveURL(/iniciar-sesion/);
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page.locator(".cart-row")).toHaveCount(1);
  await expect(page.getByLabel("Cantidad", { exact: true })).toHaveValue("3");
  await page.getByRole("button", { name: /Eliminar Kit/ }).click();
  await expect(
    page.getByRole("heading", { name: "Tu carrito está vacío." }),
  ).toBeVisible();
});

test("conflicto de otra pestaña recupera estado sin repetir la operación", async ({
  page,
}) => {
  const email = `${randomUUID()}@example.invalid`,
    password = randomBytes(20).toString("hex");
  const registered = await page.request.post("/api/v1/users", {
    headers: { Origin: "http://localhost:3002" },
    data: {
      name: "Conflicto de prueba",
      email,
      password,
      confirmPassword: password,
    },
  });
  expect(registered.status()).toBe(201);
  await page.goto("/iniciar-sesion");
  await page.getByLabel("Correo electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page
    .getByRole("button", { name: "Iniciar sesión", exact: true })
    .click();
  await expect(page).toHaveURL(/\/carrito$/);
  const products = await (await page.request.get("/api/v1/products")).json();
  const id = products.data[0].id;
  expect(
    (
      await page.request.post("/api/v1/cart/items", {
        headers: { Origin: "http://localhost:3002", "If-Match": '"0"' },
        data: { productId: id, quantity: 1 },
      })
    ).status(),
  ).toBe(201);
  await page.reload();
  await expect(page.locator(".cart-row")).toHaveCount(1);
  expect(
    (
      await page.request.patch(`/api/v1/cart/items/${id}`, {
        headers: { Origin: "http://localhost:3002", "If-Match": '"1"' },
        data: { quantity: 2 },
      })
    ).status(),
  ).toBe(200);
  await page.getByLabel("Cantidad", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.getByRole("status")).toContainText(
    "cambió en otra ventana",
  );
  await expect(page.getByLabel("Cantidad", { exact: true })).toHaveValue("2");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
