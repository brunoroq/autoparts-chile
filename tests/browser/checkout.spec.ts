import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { checkoutTestUrl } from "../checkout-database";
import {
  authContext,
  register,
  login,
  testIdentity,
} from "../auth-http-helpers";
test.use({ baseURL: "http://localhost:3004" });
test("checkout simulado, historial, teclado y resultado recuperable", async ({
  page,
}) => {
  const api = await authContext("http://localhost:3004");
  const identity = testIdentity();
  try {
    const db = new PrismaClient({
      adapter: new PrismaPg({ connectionString: checkoutTestUrl() }),
    });
    let slug: string;
    try {
      const template = await db.product.findUniqueOrThrow({
        where: { slug: "kit-de-ampolletas-led-h7" },
      });
      slug = `browser-${randomUUID()}`;
      await db.product.create({
        data: {
          sku: slug,
          slug,
          name: template.name,
          description: template.description,
          categoryId: template.categoryId,
          priceClp: template.priceClp,
          imagePath: template.imagePath,
          imageAlt: template.imageAlt,
          stock: 3,
        },
      });
    } finally {
      await db.$disconnect();
    }
    await register(api, identity);
    await login(api, identity);
    await page.context().addCookies((await api.storageState()).cookies);
    await page.goto(`/productos/${slug}`);
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect(page.getByRole("status")).toContainText("Accesorio agregado");
    await page.goto("/carrito");
    await page.getByRole("link", { name: /Continuar al checkout/ }).click();
    await expect(
      page.getByRole("heading", { name: /Revisa tu compra/ }),
    ).toBeVisible();
    const create = page.getByRole("button", { name: "Crear pedido de prueba" });
    await create.focus();
    await create.press("Enter");
    await expect(page).toHaveURL(/\/pedidos\/[a-f0-9-]+$/);
    await page
      .getByLabel("Escenario de pago simulado")
      .selectOption("timeout-approved");
    await page.getByRole("button", { name: "Simular pago" }).click();
    await expect(
      page.getByRole("heading", { name: /Pendiente de revisión/ }),
    ).toBeVisible();
    await page.reload();
    await page
      .getByRole("button", { name: "Verificar estado del pago" })
      .click();
    await expect(
      page.getByRole("heading", { name: /Compra confirmada/ }),
    ).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/checkout-${test.info().project.name}.png`,
      fullPage: true,
    });
    await page.getByRole("link", { name: /Mis pedidos/ }).click();
    await expect(
      page.getByText("Compra confirmada", { exact: false }).first(),
    ).toBeVisible();
    await page.goto("/carrito");
    await expect(
      page.getByRole("heading", { name: "Tu carrito está vacío." }),
    ).toBeVisible();
  } finally {
    await api.dispose();
  }
});
