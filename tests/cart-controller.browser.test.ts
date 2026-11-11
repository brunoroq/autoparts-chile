import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { chromium, expect, type Page } from "@playwright/test";
import type { PluginBuild } from "esbuild";
import { checkOrigin } from "../src/lib/http/input";

// Reutiliza esbuild, ya instalado como herramienta de tsx; no agrega dependencias.
const require = createRequire(import.meta.url);
const build = createRequire(require.resolve("tsx/package.json"))("esbuild").build;
const productId = "00000000-0000-4000-a000-000000000001";
type Mode = "guest-empty" | "guest-full" | "auth-empty" | "auth-full" | "guest-add" | "merge";
type Quote = { items: { productId: string; quantity: number }[]; originMatches: boolean };

async function fixture(mode: Mode, run: (page: Page, quotes: Quote[], mergeRequests: string[]) => Promise<void>, failQuote = false) {
  const entry = `
    import React, {StrictMode} from 'react';
    import {createRoot} from 'react-dom/client';
    import {CartController} from './src/components/cart/cart-controller';
    import {AnalyticsProvider} from './src/components/analytics/analytics-provider';
    import {AddToCart} from './src/components/cart/add-to-cart';
    import {AuthForm} from './src/components/auth/auth-form';
    const item = {productId:'${productId}',slug:'fixture',name:'Producto de prueba',imagePath:'/fixture.svg',imageAlt:'Fixture',unitPriceClp:8990,quantity:1,subtotalClp:8990,availableStock:50,active:true,available:true,warning:null};
    const mode = '${mode}';
    const initialCart = mode.startsWith('auth-') ? {version:7,items:mode==='auth-full'?[item]:[],totalClp:mode==='auth-full'?8990:0,currency:'CLP'} : window.__fixtureSigned ? window.__fixtureCart : null;
    const config={enabled:false,measurementId:'',debug:false,vitals:false,environment:'local',experimentId:'cart-fixture',traffic:'human',origin:location.origin};
    const content = mode==='guest-add' && location.pathname.startsWith('/productos/') ? <AddToCart productId='${productId}' slug='fixture' stock={50}/> : location.pathname==='/iniciar-sesion' ? <AuthForm callbackUrl='/checkout'/> : <CartController initialCart={initialCart}/>;
    createRoot(document.getElementById('root')).render(<StrictMode><AnalyticsProvider config={config}>{content}</AnalyticsProvider></StrictMode>);
  `;
  const bundle = await build({ stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: "cart-fixture.tsx", loader: "tsx" }, bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "next-stubs", setup(b: PluginBuild) {
    b.onResolve({ filter: /^(next\/(navigation|script|link|image)|next-auth\/react)$/ }, (args: { path: string }) => ({ path: args.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, (args: { path: string }) => ({ contents: args.path === "next/navigation"
      ? "export function usePathname(){return '/carrito'};export function useSearchParams(){return new URLSearchParams()};export function useRouter(){return {push(path){location.assign(path)},refresh(){}}}"
      : args.path === "next-auth/react" ? "export async function signIn(){const r=await fetch('/api/auth/callback/credentials',{method:'POST'});return {ok:r.ok}}"
      : args.path === "next/script" ? "export default function Script(){return null}"
        : `import React from 'react';export default function Element(props){return React.createElement('${args.path === "next/link" ? "a" : "img"}',props,props.children)}`,
    loader: "js", resolveDir: process.cwd() }));
  } }] });
  let origin = "";
  const quotes: Quote[] = [], unexpected: string[] = [];
  const mergeRequests: string[] = [];
  const snapshot = (items: Quote["items"], version = 0) => ({ version, currency: "CLP", totalClp: items.reduce((n, item) => n + item.quantity * 8990, 0), items: items.map(item => ({ ...item, slug: "fixture", name: "Producto de prueba", imagePath: "/fixture.svg", imageAlt: "Fixture", unitPriceClp: 8990, subtotalClp: item.quantity * 8990, availableStock: 50, active: true, available: true, warning: null })) });
  let signed = false, accountCart = snapshot([{ productId, quantity: 1 }], 7);
  const receipts = new Set<string>();
  const server = createServer((req, res) => {
    const json = (status: number, data: unknown) => { res.writeHead(status, { "Content-Type": "application/json" }); res.end(JSON.stringify(data)); };
    if (req.url === "/api/v1/cart") return signed ? json(200, { data: accountCart }) : json(401, { error: { code: "UNAUTHENTICATED" } });
    if (req.url === "/api/auth/callback/credentials") { signed = true; return json(200, { ok: true }); }
    if (req.url === "/api/auth/session") return json(200, signed ? { user: { id: "00000000-0000-4000-a000-000000000002" } } : {});
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(bundle.outputFiles[0].text); }
    if (req.url === "/fixture.svg") { res.setHeader("Content-Type", "image/svg+xml"); return res.end('<svg xmlns="http://www.w3.org/2000/svg"/>'); }
    if (["/api/v1/cart/guest", "/api/v1/cart/merge"].includes(req.url || "") && req.method === "POST") {
      // Simula la ausencia de Origin en transporte, conservando Fetch Metadata real.
      // Ejecuta la validación de producción, sin modificar proxies o variables reales.
      const headers = new Headers();
      for (const name of ["host", "sec-fetch-site", "referer", "x-forwarded-host"]) {
        const value = req.headers[name]; if (typeof value === "string") headers.set(name, value);
      }
      try { checkOrigin(new Request(origin + req.url, { method: "POST", headers })); }
      catch { return json(403, { error: { code: "INVALID_ORIGIN" } }); }
      let body = "";
      req.on("data", data => { body += data; });
      req.on("end", () => {
        const { items, mergeId } = JSON.parse(body) as { items: Quote["items"]; mergeId?: string };
        if (req.url === "/api/v1/cart/merge") {
          if (!signed || !mergeId) return json(401, { error: { code: "UNAUTHENTICATED" } });
          mergeRequests.push(mergeId);
          if (!receipts.has(mergeId)) {
            receipts.add(mergeId);
            accountCart = snapshot([{ productId, quantity: accountCart.items[0].quantity + items[0].quantity }], accountCart.version + 1);
          }
          return json(200, { data: accountCart });
        }
        quotes.push({ items, originMatches: req.headers.origin === origin });
        json(failQuote ? 500 : 200, failQuote ? { error: { message: "Error temporal de prueba" } } : { data: snapshot(items) });
      });
      return;
    }
    if (req.url?.startsWith("/api/")) { unexpected.push(req.url); res.writeHead(500); return res.end(); }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end(`<html lang="es"><body><div id="root"></div><script>window.__fixtureSigned=${signed};window.__fixtureCart=${JSON.stringify(accountCart)}</script><script src="/bundle.js"></script></body></html>`);
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw Error("Fixture inválida");
  origin = `http://127.0.0.1:${address.port}`;
  const previousOrigin = process.env.NEXTAUTH_URL; process.env.NEXTAUTH_URL = origin;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ baseURL: origin });
    if (mode === "guest-full" || mode === "merge") await page.addInitScript(id => {
      if (localStorage.getItem("autoparts:guest-cart:v1") === null) localStorage.setItem("autoparts:guest-cart:v1", JSON.stringify({ items: [{ productId: id, quantity: 2 }] }));
    }, productId);
    page.on("pageerror", () => unexpected.push("JS_ERROR"));
    await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto(mode === "guest-add" ? "/productos/fixture" : "/carrito");
    await run(page, quotes, mergeRequests);
    assert.deepEqual(unexpected, []);
  } finally {
    await browser.close(); await new Promise<void>(resolve => server.close(() => resolve()));
    if (previousOrigin === undefined) delete process.env.NEXTAUTH_URL; else process.env.NEXTAUTH_URL = previousOrigin;
  }
}

for (const mode of ["guest-empty", "auth-empty"] as const) {
  test(`${mode}: no cotiza ni fusiona y conserva la interfaz vacía al recargar`, async () => fixture(mode, async (page, quotes) => {
    for (let load = 0; load < 2; load++) {
      await expect(page.getByRole("heading", { name: "Tu carrito está vacío.", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: /^Explorar accesorios/ })).toHaveAttribute("href", "/catalogo");
      await expect(page.locator(".cart-row")).toHaveCount(0);
      assert.equal(quotes.length, 0);
      if (load === 0) await page.reload();
    }
  }));
}
test("invitado con productos sigue cotizando y muestra cantidades y precios del servidor", async () => fixture("guest-full", async (page, quotes) => {
  await expect(page.locator(".cart-row")).toHaveCount(1);
  await expect(page.locator('input[name="quantity"]')).toHaveValue("2");
  await expect(page.locator(".cart-subtotal")).toContainText("17.980");
  await expect(page.getByRole("link", { name: /Iniciar sesión para pagar/ })).toHaveAttribute("href", "/iniciar-sesion?callbackUrl=%2Fcheckout");
  assert.deepEqual(quotes, [{ items: [{ productId, quantity: 2 }], originMatches: true }]);
}));
test("snapshot autenticado con productos se conserva sin cotización ni fusión vacías", async () => fixture("auth-full", async (page, quotes) => {
  await expect(page.locator(".cart-row")).toHaveCount(1);
  await expect(page.locator('input[name="quantity"]')).toHaveValue("1");
  await expect(page.locator(".cart-subtotal")).toContainText("8.990");
  await expect(page.getByRole("link", { name: /Continuar al checkout/ })).toHaveAttribute("href", "/checkout");
  assert.equal(quotes.length, 0);
}));
test("un error de cotización con productos permanece visible y no borra el carrito guardado", async () => fixture("guest-full", async (page, quotes) => {
  await expect(page.getByRole("alert")).toContainText("Error temporal de prueba");
  await expect(page.getByRole("button", { name: "Volver a intentar" })).toBeVisible();
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("autoparts:guest-cart:v1")!));
  assert.deepEqual(stored.items, [{ productId, quantity: 2 }]);
  assert.equal(quotes.length, 1);
}, true));
test("invitado agrega, modifica y elimina la última línea sin quote vacío; exige login para pagar", async () => fixture("guest-add", async (page, quotes) => {
  await page.getByLabel("Cantidad", { exact: true }).fill("2");
  await page.getByRole("button", { name: "Agregar al carrito" }).click();
  await expect(page.getByRole("status")).toContainText("Accesorio agregado");
  await page.getByRole("link", { name: /Ver carrito/ }).click();
  await expect(page.locator('input[name="quantity"]')).toHaveValue("2");
  await page.getByLabel("Cantidad", { exact: true }).fill("3");
  await page.getByRole("button", { name: "Actualizar", exact: true }).click();
  await expect(page.locator(".cart-subtotal")).toContainText("26.970");
  await expect(page.getByRole("link", { name: /Iniciar sesión para pagar/ })).toHaveAttribute("href", "/iniciar-sesion?callbackUrl=%2Fcheckout");
  const beforeRemoval = quotes.length;
  await page.getByRole("button", { name: /^Eliminar / }).click();
  await expect(page.getByRole("heading", { name: "Tu carrito está vacío." })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Explorar accesorios/ })).toHaveAttribute("href", "/catalogo");
  await page.reload(); await expect(page.getByRole("heading", { name: "Tu carrito está vacío." })).toBeVisible();
  assert.equal(quotes.length, beforeRemoval);
  assert.ok(quotes.length > 0 && quotes.every(q => q.items.length > 0 && q.originMatches));
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("autoparts:guest-cart:v1")!).items), []);
}));
test("login simulado ejecuta mergeGuestCart, conserva ambas cantidades y no repite la fusión al recargar", async () => fixture("merge", async (page, quotes, merges) => {
  await expect(page.locator('input[name="quantity"]')).toHaveValue("2");
  await page.getByRole("link", { name: /Iniciar sesión para pagar/ }).click();
  await page.getByLabel("Correo electrónico").fill("fixture@example.invalid");
  await page.getByLabel("Contraseña", { exact: true }).fill("Contraseña ficticia de prueba 123");
  await page.getByRole("button", { name: /Iniciar sesión/ }).click();
  await expect(page).toHaveURL(/\/checkout$/); // Destino ficticio: no crea pedidos ni pagos.
  await expect(page.locator('input[name="quantity"]')).toHaveValue("3");
  await expect(page.getByRole("link", { name: /Continuar al checkout/ })).toHaveAttribute("href", "/checkout");
  assert.equal(merges.length, 1);
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("autoparts:guest-cart:v1")!)), { items: [] });
  const beforeReload = quotes.length;
  await page.reload(); await expect(page.locator('input[name="quantity"]')).toHaveValue("3");
  assert.equal(merges.length, 1); assert.equal(quotes.length, beforeReload);
}));
