import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer, request } from 'node:http';
import { connect } from 'node:net';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { chromium, expect } from '@playwright/test';
import type { PluginBuild } from 'esbuild';
import { browserFlow, browserInit } from '../performance/k6/browser-flow.js';
import { browserRequestAllowed, browserNetworkAllowed, googleHost, validateBrowserPlan } from '../performance/k6/browser-policy.js';
import { validSyntheticId } from '../src/lib/analytics/synthetic';
import { analyticsConfig } from '../src/lib/observability/config';
import { performanceIsolation } from '../src/lib/observability/performance-isolation';
import { browserProxy } from '../scripts/performance-browser-proxy';
import { attachAnalyticsEvidence } from '../performance/k6/browser-evidence.js';
import { sanitizeObserverLog } from '../scripts/performance-observer-evidence';
const runId = '12345678-1234-1234-1234-123456789abc';
const now = 1900000000000;
const plan = { baseUrl: 'http://127.0.0.1:3101', measurementId: 'G-LAB12345', proxyPort: 12345,
  runId, catalogSize: 30, delaySeconds: 0, createdAt: now, deadline: now + 120000 };

test('ID oficial bloqueado aunque el ID humano esté ausente; aislamiento requiere opt-in doble', () => {
  assert.equal(validSyntheticId('G-VVKYV486NP'), false);
  assert.equal(validSyntheticId('G-LAB12345', 'G-LAB12345'), false);
  for (const id of ['', 'G-lowercase', 'https://google.com', undefined]) assert.equal(validSyntheticId(id), false);
  const env = { PERF_ISOLATED: 'true', DATABASE_URL: 'postgresql://fixture:fixture@postgres:5432/autoparts_performance_test',
    NEXTAUTH_URL: plan.baseUrl, ANALYTICS_ENABLED: 'true', TRAFFIC_KIND: 'synthetic', PAYMENT_PROVIDER: 'simulated',
    EXPERIMENT_ID: runId, CATALOG_SIZE: '30', PERF_OBSERVER_CONTAINER: 'true', PERF_BROWSER_ANALYTICS: 'true', GA4_SYNTHETIC_MEASUREMENT_ID: plan.measurementId };
  assert.equal(performanceIsolation(env)?.analytics, true);
  for (const patch of [{ PERF_BROWSER_ANALYTICS: 'false' }, { PERF_OBSERVER_CONTAINER: 'false' }, { GA4_SYNTHETIC_MEASUREMENT_ID: 'G-VVKYV486NP' },
    { GA4_SYNTHETIC_MEASUREMENT_ID: '' }, { GA4_MEASUREMENT_ID: plan.measurementId }, { TRAFFIC_KIND: 'human' }, { VERCEL: '1' }]) {
    assert.throws(() => performanceIsolation({ ...env, ...patch }));
  }
});
test('configuración pública falla cerrada en laboratorio y conserva GA4 humano de producción', () => {
  const keys = ['ANALYTICS_ENABLED', 'GA4_MEASUREMENT_ID', 'GA4_SYNTHETIC_MEASUREMENT_ID', 'TRAFFIC_KIND', 'PERF_ISOLATED', 'PERF_BROWSER_ANALYTICS', 'APP_ENV'] as const;
  const before = keys.map(k => process.env[k]);
  try {
    process.env.ANALYTICS_ENABLED = 'true'; process.env.GA4_MEASUREMENT_ID = 'G-VVKYV486NP';
    process.env.GA4_SYNTHETIC_MEASUREMENT_ID = plan.measurementId; process.env.TRAFFIC_KIND = 'synthetic';
    process.env.PERF_ISOLATED = 'true'; process.env.APP_ENV = 'performance-local';
    delete process.env.PERF_BROWSER_ANALYTICS;
    assert.equal(analyticsConfig().enabled, false);
    process.env.PERF_BROWSER_ANALYTICS = 'true';
    assert.equal(analyticsConfig().enabled, true);
    process.env.GA4_SYNTHETIC_MEASUREMENT_ID = 'G-VVKYV486NP';
    assert.equal(analyticsConfig().measurementId, ''); assert.equal(analyticsConfig().enabled, false);
    process.env.TRAFFIC_KIND = 'human';
    assert.equal(analyticsConfig().enabled, false);
    delete process.env.PERF_ISOLATED; delete process.env.PERF_BROWSER_ANALYTICS;
    process.env.APP_ENV = 'vercel-production';
    assert.equal(analyticsConfig().measurementId, 'G-VVKYV486NP'); assert.equal(analyticsConfig().enabled, true);
  } finally { keys.forEach((k, i) => { if (before[i] === undefined) delete process.env[k]; else process.env[k] = before[i]; }); }
});
test('plan y red bloquean producción, cuentas, pagos y entradas directas sin plan', () => {
  assert.equal(validateBrowserPlan(plan, now), plan);
  for (const patch of [{ measurementId: 'G-VVKYV486NP' }, { baseUrl: 'https://autoparts-chile.vercel.app' },
    { deadline: now }, { proxyPort: 0 }, { delaySeconds: 91 }, { createdAt: now + 1 }]) {
    assert.throws(() => validateBrowserPlan({ ...plan, ...patch }, now));
  }
  for (const p of ['/checkout', '/registro', '/api/auth/session', '/api/v1/orders', '/api/v1/cart/merge']) {
    assert.equal(browserRequestAllowed('GET', plan.baseUrl + p), false);
    assert.equal(browserRequestAllowed('POST', plan.baseUrl + p), false);
  }
  assert.equal(browserRequestAllowed('POST', plan.baseUrl + '/api/v1/cart/guest'), true);
  assert.equal(browserRequestAllowed('GET', plan.baseUrl + '/_next/static/chunks/test.js'), true);
  assert.equal(browserRequestAllowed('GET', 'https://autoparts-chile.vercel.app/catalogo'), false);
  assert.equal(googleHost('www.google-analytics.com.evil.invalid'), false);
  assert.equal(googleHost('autoparts-chile.vercel.app'), false);
  const env = { ...process.env, DOCKER_BIN: 'missing-offline', K6_BIN: 'missing-offline' };
  for (const id of ['G-VVKYV486NP', 'bad']) {
    const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/run-performance.ts', 'plan', '--browser', '--synthetic-id', id], {env, encoding: 'utf8'});
    assert.notEqual(result.status, 0);
  }
  const dry = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/run-performance.ts', 'plan', '--browser', '--observer-only', '--synthetic-id', plan.measurementId], {env, encoding: 'utf8'});
  assert.equal(dry.status, 0);
  assert.equal(JSON.parse(dry.stdout).browser.observers, 1);
  assert.equal(JSON.parse(dry.stdout).baseUrl, plan.baseUrl);
  assert.deepEqual(JSON.parse(dry.stdout).stages, []);
  assert.equal(JSON.parse(dry.stdout).limits.maxVus,1);
  assert.equal(JSON.parse(dry.stdout).limits.maxRequests,400);
});
test('transporte Google exige el ID sintético incluso en query duplicada, body y batch', () => {
  const id = plan.measurementId;
  const collect = 'https://www.google-analytics.com/g/collect?tid=' + id;
  assert.equal(browserNetworkAllowed('GET', 'https://www.googletagmanager.com/gtag/js?id=' + id, null, id), true);
  assert.equal(browserNetworkAllowed('POST', collect, 'en=view_item\nen=add_to_cart', id), true);
  for (const [url, body] of [
    [collect + '&tid=G-VVKYV486NP', ''], [collect, 'tid=G-VVKYV486NP'], [collect, 'en=view_item\ntid=G-VVKYV486NP'],
    [collect + '&send_to=G-VVKYV486NP', ''], ['https://www.googletagmanager.com/gtag/js?id=G-VVKYV486NP', ''],
    ['https://www.google-analytics.com.evil.invalid/g/collect?tid=' + id, ''],
    ['https://www.google-analytics.com/g/collect', ''], [collect + '&tid=%', ''],
  ]) assert.equal(browserNetworkAllowed('POST', url, body, id), false);
  assert.equal(browserNetworkAllowed('GET', collect, null, 'G-VVKYV486NP'), false);
});
test('proxy rechaza destinos remotos y CONNECT ajeno a Google sin conexiones externas', async () => {
  let blocked = 0;
  const proxy = await browserProxy(Date.now() + 10000, () => blocked++);
  try {
    const status = await new Promise<number | undefined>((resolve, reject) => {
      const req = request({host: '127.0.0.1', port: proxy.port, path: 'https://autoparts-chile.vercel.app/catalogo'}, res => { res.resume(); resolve(res.statusCode); });
      req.on('error', reject); req.end();
    });
    assert.equal(status, 403);
    const denied = await new Promise<string>((resolve, reject) => {
      const socket = connect(proxy.port, '127.0.0.1', () => socket.write('CONNECT example.invalid:443 HTTP/1.1\r\nHost: example.invalid\r\n\r\n'));
      socket.once('data', b => { resolve(String(b)); socket.destroy(); }); socket.on('error', reject);
    });
    assert.match(denied, /403/); assert.equal(blocked, 2);
  } finally { await proxy.close(); }
});

test('recorrido compartido usa componentes reales y transporte GA simulado, sin cuentas ni BD', async () => {
  const require = createRequire(import.meta.url);
  const build = createRequire(require.resolve('tsx/package.json'))('esbuild').build;
  const compiled = await build({ entryPoints: ['tests/fixtures/performance-browser-harness.tsx'], bundle: true, write: false, platform: 'browser', jsx: 'automatic',
    define: { 'process.env.NODE_ENV': '"development"' }, plugins: [{name: 'next-offline', setup(b: PluginBuild) {
      b.onResolve({filter: /^next\/(script|navigation|link|image)$/}, args => ({path: args.path, namespace: 'mock'}));
      b.onLoad({filter: /.*/, namespace: 'mock'}, args => ({loader: 'js', resolveDir: process.cwd(), contents: args.path === 'next/navigation'
        ? `export const usePathname=()=>location.pathname;export const useSearchParams=()=>new URLSearchParams(location.search);`
        : args.path === 'next/script'
          ? `import {useEffect} from 'react';export default function Script({src,onReady}){useEffect(()=>{const s=document.createElement('script');s.src=src;s.onload=onReady;document.head.append(s);return ()=>s.remove()},[src]);return null}`
          : `import React from 'react';export default function Element(p){return React.createElement('${args.path === 'next/link' ? 'a' : 'img'}',p,p.children)}` }));
    }}] });
  const id = '00000000-0000-4000-a000-000000000001';
  const paths: string[] = [];
  const server = createServer(async (req, res) => {
    paths.push(`${req.method} ${req.url}`);
    if (req.url === '/bundle.js') { res.setHeader('Content-Type', 'application/javascript'); res.end(compiled.outputFiles[0].text); return; }
    if (req.url === '/api/v1/cart') { res.writeHead(401, {'Content-Type': 'application/json'}); res.end('{}'); return; }
    if (req.url === '/api/v1/cart/guest') {
      let text = ''; for await (const part of req) text += part;
      const input = JSON.parse(text); assert.equal(input.items.length, 1); assert.equal(input.items[0].quantity, 1);
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({data: {version: 0, currency: 'CLP', totalClp: 8990, items: [{productId: id, slug: 'fixture', name: 'Producto simulado', imagePath: '/images/fixture.svg', imageAlt: 'Fixture', unitPriceClp: 8990, subtotalClp: 8990, quantity: 1, availableStock: 50, active: true, available: true, warning: null}]}})); return;
    }
    if (req.url?.startsWith('/api/v1/products')) { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({data: [{id, slug: 'fixture', stock: 50, priceClp: 8990}]})); return; }
    if (req.url?.startsWith('/images/')) { res.setHeader('Content-Type', 'image/svg+xml'); res.end('<svg xmlns="http://www.w3.org/2000/svg"/>'); return; }
    res.setHeader('Content-Type', 'text/html'); res.end('<html><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); if (!address || typeof address === 'string') throw new Error();
  const chrome = await chromium.launch({channel: 'chrome', headless: true});
  try {
    const context = await chrome.newContext();
    let google = 0, denied = 0;
    await context.route('**/*', async route => {
      const url = new URL(route.request().url());
      if (url.hostname.endsWith('google-analytics.com') || url.hostname === 'www.googletagmanager.com') {
        if (!browserNetworkAllowed(route.request().method(), url.href, route.request().postData(), plan.measurementId)) {
          denied++; await route.abort(); return;
        }
      }
      if (url.hostname === 'www.googletagmanager.com') {
        google++; assert.equal(url.searchParams.get('id'), plan.measurementId);
        await route.fulfill({contentType: 'application/javascript', body: `const originalPush=window.dataLayer.push;window.dataLayer.push=function(...commands){const n=originalPush.apply(this,commands);for(const c of commands){if(c[0]==='event'){const p=c[2];const q=new URLSearchParams({tid:'G-LAB12345',en:c[1],'ep.environment':p.environment,'ep.traffic_kind':p.traffic_kind,'ep.experiment_id':p.experiment_id,cid:'private-client-ignored',sid:'private-session-ignored'});fetch('https://www.google-analytics.com/g/collect?'+q,{method:'POST'}).catch(()=>{})}}return n};`});
      } else if (url.hostname.endsWith('google-analytics.com')) {
        await route.fulfill({status:204,headers:{'Access-Control-Allow-Origin':'*'},body:''});
      } else if (url.hostname === '127.0.0.1' && url.port === String(address.port)) await route.continue();
      else { assert.fail('Solicitud externa bloqueada por el transporte offline'); }
    });
    await context.addInitScript(`(${browserInit.toString()})(${JSON.stringify({measurementId: plan.measurementId})})`);
    const page = await context.newPage(); page.setDefaultTimeout(10000);
    const diagnosed: string[] = [];
    const diagnose = (code: string) => { diagnosed.push(code); };
    const transport = attachAnalyticsEvidence(page, plan.measurementId, runId, diagnose);
    const baseUrl = `http://127.0.0.1:${address.port}`;
    await page.goto(baseUrl + '/catalogo');
    assert.equal(google, 0);
    await page.getByRole('button', {name: 'Rechazar analítica', exact: true}).click();
    await page.reload(); assert.equal(google, 0);
    await context.clearCookies();
    await page.evaluate(() => localStorage.clear());
    const result = await browserFlow(page, {...plan, baseUrl}, () => {}, async (name, count) => {
      await expect.poll(() => transport.state.rows.filter(r => r.event === name && r.httpSuccess).length).toBe(count);
    }, diagnose);
    assert.ok(diagnosed.includes('CONSENT_GRANTED'));
    assert.ok(diagnosed.includes('GTAG_QUEUE_READY'));
    assert.ok(diagnosed.includes('ANALYTICS_HTTP_RESPONSE'));
    assert.equal(result.quantity, 1); assert.equal(result.unitPriceClp, 8990);
    assert.equal(result.consent, 'granted'); assert.equal(result.javascript, true);
    assert.deepEqual(result.steps,['home','consent','catalog','product','add_to_cart','cart','remove_from_cart','empty_cart']);
    assert.deepEqual(result.events.filter(n => n !== 'page_view'), ['view_item', 'add_to_cart', 'remove_from_cart']);
    assert.equal(result.events.filter(n => n === 'page_view').length, 4);
    await expect.poll(() => transport.state.rows.length).toBe(7);
    assert.equal(transport.state.pending, 0);
    assert.ok(transport.state.rows.every(r => r.httpStatus === 204 && r.measurementId === plan.measurementId && r.labelsVerified));
    const safeLog = sanitizeObserverLog(JSON.stringify({msg:JSON.stringify({event:'browser_observer', ...result, network:transport.snapshot(), verified:true})}), plan.measurementId, runId);
    assert.equal(safeLog?.verified, true);
    assert.equal(JSON.stringify(safeLog).includes('private-client'), false);
    assert.equal(JSON.stringify(safeLog).includes('private-session'), false);
    assert.ok(google >= 1);
    assert.equal(paths.filter(p => p === 'POST /api/v1/cart/guest').length, 2);
    assert.equal(paths.some(p => /checkout|orders|merge|auth|registro/.test(p)), false);
    // Prueba del rechazo interceptado: no sale ninguna solicitud a Internet.
    await page.evaluate(() => fetch('https://www.google-analytics.com/g/collect?tid=G-VVKYV486NP').catch(() => null));
    assert.equal(denied, 1);
    await context.close();
  } finally { await chrome.close(); await new Promise<void>(resolve => server.close(() => resolve())); }
});
