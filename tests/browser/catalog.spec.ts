import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";

async function loadVisibleProducts(page: Page) {
  for (const image of await page.locator(".product-photo img").all()) {
    await image.scrollIntoViewIfNeeded();
    await expect
      .poll(() => image.evaluate((img: HTMLImageElement) => img.naturalWidth))
      .toBeGreaterThan(0);
  }
  await page.evaluate(() => window.scrollTo(0, 0));
}

test("inicio, imágenes, categorías y ausencia de desbordamiento", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Equipa tu auto. Disfruta el camino." }),
  ).toBeVisible();
  await expect(page.locator(".category-card")).toHaveCount(6);
  await expect(page.locator(".product-card")).toHaveCount(6);
  await expect(page.locator(".product-card").first()).toBeVisible();
  await expect(page.locator(".hero-image")).toHaveJSProperty("complete", true);
  expect(
    await page
      .locator(".hero-image")
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  const hero = page.locator(".hero-image");
  await expect(hero).not.toHaveAttribute("loading", "lazy");
  await expect(page.locator(".product-photo img").first()).toHaveAttribute(
    "loading",
    "lazy",
  );
  await loadVisibleProducts(page);
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole("link", { name: /Iluminación.*accesorios/ }).click();
  await expect(page).toHaveURL(/category=iluminacion/);
  await expect(page.locator(".product-card")).toHaveCount(5);
  await expect(
    page.getByRole("heading", { name: "Iluminación.", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("filtros, navegación, precios y detalle", async ({ page }) => {
  await page.goto("/catalogo?page=2");
  await page.waitForLoadState("networkidle");
  if ((await page.locator("details").getAttribute("open")) === null)
    await page.locator("summary").click();
  await page.getByLabel("Buscar producto", { exact: true }).fill("LED");
  await page.getByLabel("Iluminación", { exact: false }).check();
  await page.getByLabel("Hasta", { exact: true }).fill("30000");
  await page.getByLabel("Ordenar por").selectOption("price_desc");
  await page.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(page).not.toHaveURL(/[?&]page=2/);
  await expect(page.locator(".product-card")).toHaveCount(3);
  await expect(
    page.getByRole("heading", { name: "Iluminación.", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".product-card").first()).toBeVisible();
  await page.waitForLoadState("networkidle");
  await loadVisibleProducts(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/catalog-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.locator(".product-link").first().click();
  await expect(page).toHaveURL(/\/productos\//);
  await expect(page.locator(".detail-price")).toContainText("CLP");
  await expect(page.locator(".detail-info h1")).toBeVisible();
  await page.waitForLoadState("networkidle");
  await expect(page.locator(".detail-visual img")).toHaveJSProperty(
    "complete",
    true,
  );
  expect(
    await page
      .locator(".detail-visual img")
      .evaluate((img: HTMLImageElement) => img.naturalWidth),
  ).toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `test-results/detail-${test.info().project.name}.png`,
    fullPage: true,
  });
});

test("teclado, enlace de salto, foco, paginación y vacío", async ({ page }) => {
  await page.goto("/catalogo");
  await expect(page.locator(".product-card")).toHaveCount(12);
  await page.waitForLoadState("networkidle");
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Saltar al contenido" }),
  ).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#contenido")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator(".breadcrumbs a")).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.locator("summary")).toBeFocused();
  const outline = await page
    .locator("summary")
    .evaluate((el) => getComputedStyle(el).outlineWidth);
  expect(parseInt(outline)).toBeGreaterThan(0);
  if ((await page.locator("details").getAttribute("open")) === null)
    await page.keyboard.press("Enter");
  await page.keyboard.press("Enter");
  await expect(page.locator("details")).not.toHaveAttribute("open");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await expect(
    page.getByLabel("Buscar producto", { exact: true }),
  ).toBeFocused();
  await page.getByRole("link", { name: "Siguiente →" }).click();
  await expect(page).toHaveURL(/page=2/);
  await page.goto("/catalogo?q=zzzz-no-existe");
  await expect(
    page.getByRole("heading", { name: "No encontramos accesorios" }),
  ).toBeVisible();
  await page.goto("/productos/no-existe");
  await expect(
    page.getByRole("heading", { name: "Este camino no lleva a un producto." }),
  ).toBeVisible();
});
