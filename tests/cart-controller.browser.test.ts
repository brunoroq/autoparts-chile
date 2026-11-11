import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { chromium, expect, type Page } from "@playwright/test";
import type { PluginBuild } from "esbuild";

// Reutiliza esbuild, ya instalado como herramienta de tsx; no agrega dependencias.
const require = createRequire(import.meta.url);
const build = createRequire(require.resolve("tsx/package.json"))("esbuild").build;
const productId = "00000000-0000-4000-a000-000000000001";
type Mode = "guest-empty" | "guest-full" | "auth-empty" | "auth-full";
type Quote = { items: { productId: string; quantity: number }[]; originMatches: boolean };

async function fixture(mode: Mode, run: (page: Page, quotes: Quote[]) => Promise<void>, failQuote = false) {
  const entry = `
    import React, {StrictMode} from 'react';
    import {createRoot} from 'react-dom/client';
    import {CartController} from './src/components/cart/cart-controller';
    import {AnalyticsProvider} from './src/components/analytics/analytics-provider';
    const item = {productId:'${productId}',slug:'fixture',name:'Producto de prueba',imagePath:'/fixture.svg',imageAlt:'Fixture',unitPriceClp:8990,quantity:1,subtotalClp:8990,availableStock:50,active:true,available:true,warning:null};
    const mode = '${mode}';
    const initialCart = mode.startsWith('auth-') ? {version:7,items:mode==='auth-full'?[item]:[],totalClp:mode==='auth-full'?8990:0,currency:'CLP'} : null;
    const config={enabled:false,measurementId:'',debug:false,vitals:false,environment:'local',experimentId:'cart-fixture',traffic:'human',origin:location.origin};
    createRoot(document.getElementById('root')).render(<StrictMode><AnalyticsProvider config={config}><CartController initialCart={initialCart}/></AnalyticsProvider></StrictMode>);
  `;
  const bundle = await build({ stdin: { contents: entry, resolveDir: process.cwd(), sourcefile: "cart-fixture.tsx", loader: "tsx" }, bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"production"' }, plugins: [{ name: "next-stubs", setup(b: PluginBuild) {
    b.onResolve({ filter: /^next\/(navigation|script|link|image)$/ }, (args: { path: string }) => ({ path: args.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, (args: { path: string }) => ({ contents: args.path === "next/navigation"
      ? "export function usePathname(){return '/carrito'};export function useSearchParams(){return new URLSearchParams()}"
      : args.path === "next/script" ? "export default function Script(){return null}"
        : `import React from 'react';export default function Element(props){return React.createElement('${args.path === "next/link" ? "a" : "img"}',props,props.children)}`,
    loader: "js", resolveDir: process.cwd() }));
  } }] });
  let origin = "";
  const quotes: Quote[] = [], unexpected: string[] = [];
  const server = createServer((req, res) => {
    if (req.url === "/bundle.js") { res.setHeader("Content-Type", "application/javascript"); return res.end(bundle.outputFiles[0].text); }
    if (req.url === "/fixture.svg") { res.setHeader("Content-Type", "image/svg+xml"); return res.end('<svg xmlns="http://www.w3.org/2000/svg"/>'); }
    if (req.url === "/api/v1/cart/guest" && req.method === "POST") {
      let body = "";
      req.on("data", data => { body += data; });
      req.on("end", () => {
        const { items } = JSON.parse(body) as { items: Quote["items"] };
        quotes.push({ items, originMatches: req.headers.origin === origin });
        res.writeHead(failQuote ? 500 : 200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(failQuote ? { error: { message: "Error temporal de prueba" } } : { data: {
          version: 0, currency: "CLP", totalClp: items.reduce((n, item) => n + item.quantity * 8990, 0),
          items: items.map(item => ({ ...item, slug: "fixture", name: "Producto de prueba", imagePath: "/fixture.svg", imageAlt: "Fixture", unitPriceClp: 8990, subtotalClp: item.quantity * 8990, availableStock: 50, active: true, available: true, warning: null })),
        } }));
      });
      return;
    }
    if (req.url?.startsWith("/api/")) { unexpected.push(req.url); res.writeHead(500); return res.end(); }
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.end('<html lang="es"><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw Error("Fixture inválida");
  origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ baseURL: origin });
    if (mode === "guest-full") await page.addInitScript(id => localStorage.setItem("autoparts:guest-cart:v1", JSON.stringify({ items: [{ productId: id, quantity: 2 }] })), productId);
    page.on("pageerror", () => unexpected.push("JS_ERROR"));
    await page.route("**/*", route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());
    await page.goto("/carrito");
    await run(page, quotes);
    assert.deepEqual(unexpected, []);
  } finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
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
  await expect(page.getByRole("link", { name: /Continuar al checkout/ })).toHaveAttribute("href", "/iniciar-sesion?callbackUrl=%2Fcheckout");
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
