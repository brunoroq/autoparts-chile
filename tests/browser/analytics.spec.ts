import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "../../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { analyticsTestUrl } from "../analytics-database";
import {
  authContext,
  testIdentity,
  register,
  login,
} from "../auth-http-helpers";
test.use({ baseURL: "http://localhost:3005" });
test("script de Google bloqueado no consume la reclamación de purchase", async ({
  page,
}) => {
  const api = await authContext("http://localhost:3005"),
    identity = testIdentity();
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: analyticsTestUrl() }),
  });
  try {
    const user = await register(api, identity);
    await login(api, identity);
    await page.context().addCookies((await api.storageState()).cookies);
    const product = await db.product.findFirstOrThrow();
    const order = await db.order.create({
      data: {
        userId: user.id,
        status: "PAID",
        totalClp: 12345,
        idempotencyKey: randomUUID(),
        items: {
          create: {
            productId: product.id,
            productName: product.name,
            unitPriceClp: 12345,
            quantity: 1,
          },
        },
      },
    });
    await page.addInitScript(() =>
      localStorage.setItem("autoparts:analytics-consent:v1", "granted"),
    );
    await page.route("https://www.googletagmanager.com/**", (route) =>
      route.abort(),
    );
    await page.goto(`/pedidos/${order.id}`);
    await expect(
      page.getByRole("heading", { name: /Compra confirmada/ }),
    ).toBeVisible();
    expect(
      (await db.order.findUniqueOrThrow({ where: { id: order.id } }))
        .analyticsPurchaseClaimedAt,
    ).toBe(null);
    expect(
      (
        await api.post(`/api/v1/orders/${order.id}/analytics-purchase`)
      ).status(),
    ).toBe(403);
  } finally {
    await api.dispose();
    await db.$disconnect();
  }
});
async function commands(page: Page, name: string) {
  return page.evaluate(
    (n) =>
      ((window as unknown as { __ga?: unknown[][] }).__ga || []).filter(
        (c) => c[0] === "event" && c[1] === n,
      ),
    name,
  );
}
async function intercept(page: Page) {
  const calls: string[] = [];
  await page.route("https://www.googletagmanager.com/**", async (route) => {
    calls.push(route.request().url());
    await route.fulfill({
      contentType: "application/javascript",
      body: "window.__ga=[];window.gtag=function(){window.__ga.push(Array.from(arguments));};",
    });
  });
  await page.route(/https:\/\/[^/]*google-analytics\.com\//, (route) =>
    route.abort(),
  );
  return calls;
}
test("consentimiento, cuatro eventos CLP, deduplicación, privacidad y Web Vitals", async ({
  page,
}) => {
  const calls = await intercept(page),
    api = await authContext("http://localhost:3005");
  const identity = testIdentity();
  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: analyticsTestUrl() }),
  });
  try {
    const category = await db.category.findFirstOrThrow();
    const slug = `analytics-${randomUUID()}`;
    await db.product.create({
      data: {
        sku: slug,
        slug,
        name: "Accesorio de prueba",
        description: "Producto aislado",
        priceClp: 12345,
        stock: 5,
        categoryId: category.id,
      },
    });
    await register(api, identity);
    await login(api, identity);
    await page.context().addCookies((await api.storageState()).cookies);
    await page.goto(
      `/productos/${slug}?token_ws=never-send&email=private@example.invalid`,
    );
    await expect(
      page.getByRole("button", { name: "Aceptar analítica" }),
    ).toBeVisible();
    expect(calls).toHaveLength(0);
    await page.getByRole("button", { name: "Aceptar analítica" }).click();
    await expect
      .poll(async () => (await commands(page, "view_item")).length)
      .toBe(1);
    const item = (await commands(page, "view_item"))[0][2] as {
      value: number;
      currency: string;
    };
    expect(item.value).toBe(12345);
    expect(item.currency).toBe("CLP");
    await page.reload();
    await expect
      .poll(async () => await page.evaluate(() => !!window.gtag))
      .toBe(true);
    expect(await commands(page, "view_item")).toHaveLength(0);
    await page.getByLabel("Cantidad", { exact: true }).fill("2");
    await page.getByRole("button", { name: "Agregar al carrito" }).click();
    await expect
      .poll(async () => (await commands(page, "add_to_cart")).length)
      .toBe(1);
    expect(
      ((await commands(page, "add_to_cart"))[0][2] as { value: number }).value,
    ).toBe(24690);
    await page.goto("/checkout");
    await expect
      .poll(async () => (await commands(page, "begin_checkout")).length)
      .toBe(1);
    await page.reload();
    await expect
      .poll(async () => await page.evaluate(() => !!window.gtag))
      .toBe(true);
    expect(await commands(page, "begin_checkout")).toHaveLength(0);
    await page.getByRole("button", { name: "Crear pedido de prueba" }).click();
    await page.getByRole("button", { name: "Simular pago" }).click();
    await expect(
      page.getByRole("heading", { name: /Compra confirmada/ }),
    ).toBeVisible();
    await expect
      .poll(async () => (await commands(page, "purchase")).length)
      .toBe(1);
    const purchase = (await commands(page, "purchase"))[0][2] as {
      value: number;
      transaction_id: string;
    };
    expect(purchase.value).toBe(24690);
    expect(purchase.transaction_id).toBe(page.url().split("/").pop());
    const payload = await page.evaluate(() =>
      JSON.stringify((window as unknown as { __ga: unknown }).__ga),
    );
    for (const secret of [
      identity.email,
      identity.password,
      "never-send",
      "private@example.invalid",
      "token_ws",
    ])
      expect(payload).not.toContain(secret);
    await page.reload();
    await expect
      .poll(async () => await page.evaluate(() => !!window.gtag))
      .toBe(true);
    expect(await commands(page, "purchase")).toHaveLength(0);
    const orderId = page.url().split("/").pop()!;
    const claim = await api.post(
      `/api/v1/orders/${orderId}/analytics-purchase`,
      { headers: { "X-Analytics-Consent": "granted" } },
    );
    expect((await claim.json()).data).toBe(null);
    const vital = await api.post("/api/v1/telemetry/web-vitals", {
      data: {
        metrics: [
          {
            id: "metric-test",
            name: "INP",
            value: 120,
            sequence: 1,
            path: "/pedidos/private",
            device: "mobile",
          },
        ],
      },
    });
    expect(vital.status()).toBe(200);
    expect(
      (
        await api.post("/api/v1/telemetry/web-vitals", {
          data: {
            metrics: [
              {
                id: "bad",
                name: "CLS",
                value: -1,
                sequence: 1,
                path: "/",
                device: "mobile",
              },
            ],
          },
        })
      ).status(),
    ).toBe(400);
    await page
      .getByRole("button", { name: "Preferencias de analítica" })
      .click();
    await expect(
      page.getByRole("button", { name: "Rechazar analítica" }),
    ).toBeVisible();
    const before = calls.length;
    await page.getByRole("button", { name: "Rechazar analítica" }).click();
    await page.reload();
    await expect(
      page.getByRole("button", { name: "Preferencias de analítica" }),
    ).toBeVisible();
    expect(calls.length).toBe(before);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  } finally {
    await api.dispose();
    await db.$disconnect();
  }
});
test("sin consentimiento ni configuración no hay Google; autorización y validaciones HTTP", async ({
  page,
}) => {
  const calls = await intercept(page);
  await page.goto("/catalogo");
  await page.getByRole("button", { name: "Rechazar analítica" }).click();
  await page.reload();
  expect(calls).toHaveLength(0);
  const guest = await authContext("http://localhost:3005");
  try {
    expect(
      (
        await guest.post(`/api/v1/orders/${randomUUID()}/analytics-purchase`, {
          headers: { "X-Analytics-Consent": "granted" },
        })
      ).status(),
    ).toBe(401);
    expect(
      (
        await guest.post("/api/v1/telemetry/web-vitals", {
          headers: { Origin: "https://foreign.invalid" },
          data: { metrics: [] },
        })
      ).status(),
    ).toBe(403);
  } finally {
    await guest.dispose();
  }
  await page.goto("http://localhost:3000/catalogo");
  expect(await page.locator('script[src*="googletagmanager"]').count()).toBe(0);
});
