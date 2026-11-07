import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { readFile, mkdir } from "node:fs/promises";
import { chromium, expect, type Page } from "@playwright/test";
import type { PluginBuild } from "esbuild";
// esbuild ya forma parte de la herramienta tsx instalada; no es una dependencia de producción.
const require = createRequire(import.meta.url);
const build = createRequire(require.resolve("tsx/package.json"))("esbuild").build;
async function commands(page: Page, name: string) {
  return page.evaluate(n => ((window as unknown as { __ga?: unknown[][] }).__ga || []).filter(c => c[0] === "event" && c[1] === n), name);
}
async function fixture(run: (page: Page, state: { googleLoads: number; failRemoval: boolean; claims: number }) => Promise<void>) {
  const state = { googleLoads: 0, failRemoval: false, claims: 0 };
  const stylesheet = (await readFile("src/app/globals.css", "utf8")).replace('@import "tailwindcss";', "");
  const bundle = await build({ entryPoints: ["tests/fixtures/analytics-harness.tsx"], bundle: true, write: false, platform: "browser", jsx: "automatic", define: { "process.env.NODE_ENV": '"development"' }, plugins: [{ name: "next-fixtures", setup(b: PluginBuild) {
    b.onResolve({ filter: /^next\/(script|navigation|link|image)$/ }, (args: { path: string }) => ({ path: args.path, namespace: "fixture" }));
    b.onLoad({ filter: /.*/, namespace: "fixture" }, (args: { path: string }) => {
      const contents = args.path === "next/navigation"
        ? `import {useSyncExternalStore,useMemo} from 'react';export function useSearchParams(){const search=useSyncExternalStore(cb=>{window.addEventListener('popstate',cb);return ()=>window.removeEventListener('popstate',cb)},()=>location.search,()=>'');return useMemo(()=>new URLSearchParams(search),[search]);}export function usePathname(){return useSyncExternalStore(cb=>{window.addEventListener('popstate',cb);return ()=>window.removeEventListener('popstate',cb)},()=>location.pathname,()=>'/');}`
        : args.path === "next/script"
          ? `import React,{useEffect} from 'react';export default function Script({src,onReady}){useEffect(()=>{const s=document.createElement('script');s.src=src;s.onload=onReady;document.head.append(s);return ()=>s.remove()},[src]);return null;}`
          : `import React from 'react';export default function Element(props){return React.createElement('${args.path === "next/link" ? "a" : "img"}',props,props.children);}`;
      return { contents, loader: "js", resolveDir: process.cwd() };
    });
  } }] });
  const server = createServer((req, res) => {
    if (req.url === "/styles.css") { res.writeHead(200, { "Content-Type": "text/css" }); return res.end(stylesheet); }
    if (req.url?.endsWith("/analytics-purchase")) {
      state.claims++;
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ data: state.claims === 1 ? { currency: "CLP", value: 8990, items: [{ item_id: "00000000-0000-4000-a000-000000000001", price: 8990, quantity: 1 }], transaction_id: "00000000-0000-4000-a000-000000000002" } : null }));
    }
    if (req.url === "/bundle.js") { res.writeHead(200, { "Content-Type": "application/javascript" }); return res.end(bundle.outputFiles[0].text); }
    if (req.url?.startsWith("/api/")) { res.writeHead(state.failRemoval ? 500 : 200, { "Content-Type": "application/json" }); return res.end(JSON.stringify(state.failRemoval ? { error: { message: "Error simulado" } } : { data: { version: 2, items: [], totalClp: 0, currency: "CLP" } })); }
    if (req.url === "/fixture.svg") { res.writeHead(200, { "Content-Type": "image/svg+xml" }); return res.end('<svg xmlns="http://www.w3.org/2000/svg"/>'); }
    res.writeHead(200, { "Content-Type": "text/html" }); res.end('<html lang="es"><head><meta name="viewport" content="width=device-width, initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address(); if (!address || typeof address === "string") throw Error("Fixture unavailable");
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  try {
    const page = await browser.newPage({ baseURL: `http://127.0.0.1:${address.port}` });
    page.setDefaultTimeout(10000);
    await page.route("https://www.googletagmanager.com/**", async route => { state.googleLoads++; await route.fulfill({ contentType: "application/javascript", body: "window.__ga=window.__ga||[];window.gtag=function(){window.__ga.push(Array.from(arguments))}" }); });
    await page.route(/https:\/\/[^/]*google-analytics\.com\//, route => route.abort());
    await page.goto("/productos/first?token=secret&email=private@example.invalid");
    await run(page, state);
  } finally { await browser.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
}
for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 568 }, { width: 844, height: 390 }]) {
  test(`aviso visible y teclado: ${viewport.width}x${viewport.height}, aceptación, rechazo y revocación`, async () => fixture(async (page, state) => {
    await page.setViewportSize(viewport);
    const region = page.getByRole("region", { name: "Preferencias de analítica" });
    await expect(region).toBeVisible();
    const geometry = await region.evaluate(el => {
      const r = el.getBoundingClientRect(), s = getComputedStyle(el);
      return { position: s.position, z: Number(s.zIndex), inside: r.top >= 0 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth, noOverflow: document.documentElement.scrollWidth <= innerWidth };
    });
    assert.equal(geometry.position, "fixed"); assert.ok(geometry.z >= 1000); assert.ok(geometry.inside && geometry.noOverflow);
    const accept = region.getByRole("button", { name: "Aceptar analítica" });
    const reject = region.getByRole("button", { name: "Rechazar analítica" });
    for (const button of [accept, reject]) {
      const box = await button.boundingBox(); assert.ok(box && box.height >= 44 && box.width >= 44);
      assert.ok(await button.evaluate(el => { const r = el.getBoundingClientRect(); return el.contains(document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)); }));
    }
    assert.equal(await accept.evaluate(el => getComputedStyle(el).backgroundColor), await reject.evaluate(el => getComputedStyle(el).backgroundColor));
    assert.equal(state.googleLoads, 0); assert.equal((await commands(page, "page_view")).length, 0);
    await mkdir("tmp/consent-preview", { recursive: true });
    await page.screenshot({ path: `tmp/consent-preview/${viewport.width}x${viewport.height}.png`, mask: [page.locator("input,textarea")] });
    await accept.focus(); await expect(accept).toBeFocused();
    assert.equal(await accept.evaluate(el => getComputedStyle(el).outlineStyle), "solid");
    await page.keyboard.press("Tab"); await expect(reject).toBeFocused(); await page.keyboard.press("Enter");
    await expect(region).toHaveCount(0); assert.equal(state.googleLoads, 0);
    await page.reload();
    const preferences = page.getByRole("button", { name: "Preferencias de analítica" });
    await expect(preferences).toBeVisible();
    assert.ok(await preferences.evaluate(el => { const r = el.getBoundingClientRect(); return r.bottom <= innerHeight && r.right <= innerWidth && r.height >= 44; }));
    await preferences.click(); await expect(region).toBeVisible();
    await accept.focus(); await page.keyboard.press("Space");
    await expect.poll(() => state.googleLoads).toBeGreaterThan(0);
    await expect(region).toHaveCount(0);
    await preferences.click(); await expect(region).toBeVisible();
    assert.equal(await page.locator('script[src*="googletagmanager"]').count(), 0);
    assert.equal((await commands(page, "page_view")).length, 0);
  }));
}
test("consentimiento, StrictMode, renders, recargas, regreso a rutas y privacidad", async () => fixture(async (page, state) => {
  await expect(page.getByRole("button", { name: "Aceptar analítica" })).toBeVisible();
  assert.equal(state.googleLoads, 0);
  await page.getByRole("button", { name: "Rechazar analítica" }).click(); await page.reload();
  await expect(page.getByRole("button", { name: "Preferencias de analítica" })).toBeVisible(); assert.equal(state.googleLoads, 0);
  await page.getByRole("button", { name: "Preferencias de analítica" }).click();
  await page.getByRole("button", { name: "Aceptar analítica" }).click();
  await expect.poll(async () => (await commands(page, "view_item")).length).toBe(1);
  assert.equal((await commands(page, "page_view")).length, 1);
  await page.getByRole("button", { name: "Render adicional" }).click();
  assert.equal((await commands(page, "view_item")).length, 1);
  assert.equal((await commands(page, "page_view")).length, 1);
  await page.getByRole("button", { name: "/productos/second", exact: true }).click();
  await expect.poll(async () => (await commands(page, "view_item")).length).toBe(2);
  await page.getByRole("button", { name: "/productos/first", exact: true }).click();
  await expect.poll(async () => (await commands(page, "view_item")).length).toBe(3);
  assert.equal((await commands(page, "page_view")).length, 3);
  await page.reload();
  await expect.poll(async () => (await commands(page, "view_item")).length).toBe(1);
  assert.equal((await commands(page, "page_view")).length, 1);
  await page.getByRole("button", { name: "/checkout", exact: true }).click();
  await expect.poll(async () => (await commands(page, "begin_checkout")).length).toBe(1);
  await page.getByRole("button", { name: "Render adicional" }).click();
  assert.equal((await commands(page, "begin_checkout")).length, 1);
  await page.getByRole("button", { name: "/catalogo", exact: true }).click();
  await page.getByRole("button", { name: "/checkout", exact: true }).click();
  await expect.poll(async () => (await commands(page, "begin_checkout")).length).toBe(2);
  await page.goBack();
  await page.goBack();
  await expect.poll(async () => (await commands(page, "begin_checkout")).length).toBe(3);
  const beforeFilters = (await commands(page, "page_view")).length;
  await page.getByRole("button", { name: "/catalogo?q=fixture", exact: true }).click();
  await expect.poll(async () => (await commands(page, "page_view")).length).toBe(beforeFilters + 1);
  await page.getByRole("button", { name: "/catalogo?q=second", exact: true }).click();
  await expect.poll(async () => (await commands(page, "page_view")).length).toBe(beforeFilters + 2);
  const all = await page.evaluate(() => (window as unknown as { __ga: unknown[][] }).__ga);
  assert.ok(!JSON.stringify(all).includes("debug_mode")); assert.ok(!JSON.stringify(all).includes("secret")); assert.ok(!JSON.stringify(all).includes("private@example"));
}));
test("debug_mode solo se incluye al activar debug; el consentimiento revocado detiene eventos", async () => fixture(async (page) => {
  await page.goto("/productos/first?debug=true");
  await page.getByRole("button", { name: "Aceptar analítica" }).click();
  await expect.poll(async () => (await commands(page, "view_item")).length).toBe(1);
  const event = (await commands(page, "view_item"))[0][2] as { debug_mode?: boolean };
  assert.equal(event.debug_mode, true);
  await page.getByRole("button", { name: "Preferencias de analítica" }).click();
  await expect(page.getByRole("button", { name: "Aceptar analítica" })).toBeVisible();
  assert.equal((await commands(page, "page_view")).length, 0);
  await page.getByRole("button", { name: "/productos/second", exact: true }).click();
  assert.equal((await commands(page, "view_item")).length, 0);
}));
test("purchase conserva transaction_id y respeta la reclamación simulada tras renders, regresos y recargas", async () => fixture(async (page, state) => {
  await page.getByRole("button", { name: "/pedido-simulado", exact: true }).click();
  assert.equal(state.claims, 0);
  await page.getByRole("button", { name: "Aceptar analítica" }).click();
  await expect.poll(async () => (await commands(page, "purchase")).length).toBe(1);
  assert.equal(((await commands(page, "purchase"))[0][2] as { transaction_id: string }).transaction_id, "00000000-0000-4000-a000-000000000002");
  await page.getByRole("button", { name: "Render adicional" }).click();
  assert.equal(state.claims, 1);
  await page.getByRole("button", { name: "/catalogo", exact: true }).click();
  await page.getByRole("button", { name: "/pedido-simulado", exact: true }).click();
  await expect.poll(() => state.claims).toBe(2);
  assert.equal((await commands(page, "purchase")).length, 1);
  await page.reload();
  await expect.poll(() => state.claims).toBe(3);
  assert.equal((await commands(page, "purchase")).length, 0);
}));
test("remove_from_cart exitoso autenticado e invitado; fallos y falta de consentimiento no emiten", async () => fixture(async (page, state) => {
  await page.getByRole("button", { name: "/carrito", exact: true }).click();
  await page.getByRole("button", { name: /^Eliminar / }).click();
  await expect(page.getByRole("heading", { name: "Tu carrito está vacío." })).toBeVisible();
  assert.equal(state.googleLoads, 0); assert.equal((await commands(page, "remove_from_cart")).length, 0);
  await page.getByRole("button", { name: "Aceptar analítica" }).click();
  await expect.poll(() => state.googleLoads).toBeGreaterThan(0);
  await page.getByRole("button", { name: "/catalogo", exact: true }).click();
  await page.getByRole("button", { name: "/carrito", exact: true }).click();
  state.failRemoval = true;
  await page.getByRole("button", { name: /^Eliminar / }).click();
  await expect(page.getByRole("status")).toContainText("Error simulado"); assert.equal((await commands(page, "remove_from_cart")).length, 0);
  state.failRemoval = false;
  await page.getByRole("button", { name: /^Eliminar / }).click();
  await expect.poll(async () => (await commands(page, "remove_from_cart")).length).toBe(1);
  const value = (await commands(page, "remove_from_cart"))[0][2] as { currency: string; value: number; items: { quantity: number; price: number }[] };
  assert.equal(value.currency, "CLP"); assert.equal(value.value, 17980); assert.equal(value.items[0].quantity, 2); assert.equal(value.items[0].price, 8990);
  await page.getByRole("button", { name: "/invitado", exact: true }).click();
  await page.getByRole("button", { name: /^Eliminar / }).click();
  await expect.poll(async () => (await commands(page, "remove_from_cart")).length).toBe(2);
  await page.getByRole("button", { name: "Render adicional" }).click(); assert.equal((await commands(page, "remove_from_cart")).length, 2);
}));
