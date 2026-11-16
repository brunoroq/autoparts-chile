import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { PURCHASE_URL, validatePurchasePlan, validatePurchaseMarker, allowedPurchaseRequest, purchaseBudget, type PurchasePlan } from '../performance/k6/purchase-policy.js';
import { purchaseFlow, type PurchaseTransport } from '../performance/k6/purchase-flow.js';
import { purchaseIsolation } from '../src/lib/observability/purchase-isolation';
import { validatePurchaseContainers, type PurchaseContainer } from '../scripts/purchase-environment';
import { limits } from '../performance/k6/scenarios.js';
import { purchaseAccount } from '../scripts/purchase-accounts';

const id = '12345678-1234-4234-8234-123456789abc';
const now = 1900000000000;
const plan: PurchasePlan = { workload: 'purchase', baseUrl: PURCHASE_URL, runId: id, environmentId: id,
  paymentProvider: 'SIMULATED', analytics: false, vus: 1, maxPurchases: 1, maxRequests: 100, seconds: 90, createdAt: now, deadline: now + 90000 };
const marker = { isolated: true, workload: 'purchase', runId: id, origin: PURCHASE_URL, database: 'autoparts_purchase_test', paymentProvider: 'SIMULATED', analytics: false, measurementId: '', syntheticMeasurementId: '' };
const env = { PERF_PURCHASE_ISOLATED: 'true', DATABASE_URL: 'postgresql://fixture:fixture@purchase-postgres:5432/autoparts_purchase_test',
  NEXTAUTH_URL: PURCHASE_URL, PAYMENT_PROVIDER: 'simulated', WEBPAY_ENVIRONMENT: 'integration', TRAFFIC_KIND: 'synthetic',
  ANALYTICS_ENABLED: 'false', GA4_MEASUREMENT_ID: '', GA4_SYNTHETIC_MEASUREMENT_ID: '', PERF_BROWSER_ANALYTICS: 'false', EXPERIMENT_ID: id };

test('planes de compra rechazan remotos, otros laboratorios, excesos y caducidad', () => {
  assert.equal(validatePurchasePlan(plan, now), plan);
  for (const change of [{ baseUrl: 'https://autoparts-chile.vercel.app' }, { baseUrl: 'http://127.0.0.1:3100' }, { baseUrl: 'http://127.0.0.1:3004' }, { vus: 11 }, { maxPurchases: 11 }, { maxRequests: 501 }, { maxRequests: 19 }, { seconds: 121 }, { deadline: now }, { analytics: true }, { paymentProvider: 'WEBPAY_INTEGRATION' }]) {
    assert.throws(() => validatePurchasePlan({ ...plan, ...change } as PurchasePlan, now));
  }
  for (let vus = 1; vus <= 10; vus++) for (let purchases = vus; purchases <= 10; purchases++) {
    const p = { ...plan, vus, maxPurchases: purchases, maxRequests: 500 };
    assert.ok(Array.from({ length: vus }, (_, i) => purchaseBudget(p, i + 1)).reduce((a, b) => a + b, 0) + vus * 4 + 1 <= 500);
  }
  assert.throws(() => purchaseBudget(plan, 2));
  assert.throws(() => validatePurchasePlan({ ...plan, accounts: [] } as PurchasePlan, now));
  assert.equal(limits.maxVus, 30); assert.equal(limits.maxRequests, 10000);
});

test('marcador y configuración efectiva requieren simulador y base exclusiva, GA4 apagado', () => {
  assert.deepEqual(purchaseIsolation(env), marker);
  validatePurchaseMarker(marker, plan);
  assert.equal(purchaseIsolation({}), null);
  for (const change of [{ VERCEL: '1' }, { PERF_ISOLATED: 'true' }, { PAYMENT_PROVIDER: 'webpay_integration' }, { WEBPAY_ENVIRONMENT: 'production' }, { ANALYTICS_ENABLED: 'true' }, { GA4_MEASUREMENT_ID: 'G-VVKYV486NP' }, { GA4_SYNTHETIC_MEASUREMENT_ID: 'G-BLNW54CZ2R' }, { DATABASE_URL: 'postgresql://fixture:fixture@ep-test.neon.tech/neondb' }, { DATABASE_URL: env.DATABASE_URL.replace('purchase_test', 'performance_test') }, { NEXTAUTH_URL: 'http://127.0.0.1:3100' }]) assert.throws(() => purchaseIsolation({ ...env, ...change }));
  for (const change of [{ runId: 'wrong' }, { analytics: true }, { paymentProvider: 'WEBPAY_INTEGRATION' }, { origin: 'http://127.0.0.1:3100' }]) assert.throws(() => validatePurchaseMarker({ ...marker, ...change }, plan));
});

test('lista de compra no permite Webpay, reconciliación, registro ni destinos externos', () => {
  for (const route of ['https://www.google-analytics.com/mp/collect', '//remote.invalid', '/api/v1/payments/webpay/return', '/api/v1/users', '/api/v1/cart/merge', '/api/v1/orders/' + id + '/reconcile', '/api/v1/checkout?x=1', '/api/v1/products/%2e%2e']) for (const method of ['GET', 'POST']) assert.equal(allowedPurchaseRequest(method, route), false);
  assert.equal(allowedPurchaseRequest('POST', '/api/v1/payments/' + id + '/simulate'), true);
  assert.equal(allowedPurchaseRequest('GET', '/api/v1/orders/' + id), true);
});

function fixture(options: { badMarker?: boolean; timeout?: boolean; foreignProvider?: boolean } = {}) {
  let added = false, paid = false, checkouts = 0, simulations = 0;
  const calls: { method: string; route: string }[] = [];
  const item = { productId: id, quantity: 1, unitPriceClp: 24990 };
  const transport: PurchaseTransport = (method, route, body, headers) => {
    assert.ok(allowedPurchaseRequest(method, route)); calls.push({ method, route });
    let result: unknown;
    if (route === '/api/performance/status') result = options.badMarker ? { ...marker, paymentProvider: 'WEBPAY_INTEGRATION' } : marker;
    else if (route === '/api/auth/csrf') result = { csrfToken: 'fixture-only' };
    else if (route === '/api/auth/callback/credentials') { assert.equal(body?.csrfToken, 'fixture-only'); result = { url: PURCHASE_URL + '/carrito' }; }
    else if (route === '/api/auth/session') result = { user: { id, email: account.email } };
    else if (route === '/api/v1/cart') result = { data: { items: added && !paid ? [item] : [], version: 0 } };
    else if (route === '/api/v1/products') result = { data: [{ id, stock: 5, priceClp: 24990, active: true }] };
    else if (route === '/api/v1/products/' + id) result = { data: { id, stock: paid ? 4 : 5, priceClp: 24990 } };
    else if (route === '/api/v1/cart/items') { assert.equal(headers?.['If-Match'], '"0"'); assert.deepEqual(body, { productId: id, quantity: 1 }); added = true; result = { data: { items: [item], version: 1, totalClp: 24990 } }; }
    else if (route === '/api/v1/checkout') {
      assert.deepEqual(body, { cartVersion: 1 }); assert.equal(headers?.['Idempotency-Key'], id + '_1'); checkouts++;
      if (options.timeout) return { status: 0, json: () => null };
      result = { data: { id, status: 'PENDING', totalClp: 24990, payment: { id, provider: options.foreignProvider ? 'WEBPAY_INTEGRATION' : 'SIMULATED', status: 'PENDING' } } };
    } else if (route.endsWith('/simulate')) { simulations++; paid = true; assert.deepEqual(body, { scenario: 'approved' }); result = { data: { id, status: 'PAID', payment: { provider: 'SIMULATED', status: 'APPROVED', providerState: 'AUTHORIZED' } } }; }
    else if (route === '/api/v1/orders/' + id) result = { data: { id, status: 'PAID', totalClp: 24990, items: [item] } };
    else throw new Error('UNEXPECTED_ROUTE');
    return { status: route === '/api/v1/cart/items' ? 201 : 200, json: () => result };
  };
  return { transport, calls, counts: () => ({ checkouts, simulations }) };
}
const account = { email: 'fixture@example.invalid', password: 'fixture-only-not-a-real-password' };
test('cuentas exclusivas se derivan en memoria; configuración Compose mantiene red y puertos privados', () => {
  const accounts = Array.from({ length: 10 }, (_, i) => purchaseAccount(id, 'a'.repeat(64), i + 1));
  assert.equal(new Set(accounts.map(a => a.email)).size, 10);
  assert.equal(new Set(accounts.map(a => a.password)).size, 10);
  assert.deepEqual(purchaseAccount(id, 'a'.repeat(64), 1), accounts[0]);
  assert.throws(() => purchaseAccount(id, '', 1));
  assert.throws(() => purchaseAccount(id, 'a'.repeat(64), 11));
  const compose = readFileSync('compose.purchase-performance.yaml', 'utf8');
  assert.match(compose, /127\.0\.0\.1:3102:3000/);
  assert.match(compose, /internal: true/);
  assert.match(compose, /enable_ip_masquerade: "false"/);
  assert.match(compose, /PAYMENT_PROVIDER: simulated/);
  assert.match(compose, /ANALYTICS_ENABLED: "false"/);
  assert.doesNotMatch(compose, /neon\.tech|vercel\.app|G-VVKYV486NP|5432:5432/);
});
test('flujo simulado verifica CSRF, If-Match, idempotencia, pedido, precio, stock y carrito', () => {
  const f = fixture();
  assert.deepEqual(purchaseFlow(f.transport, plan, account, id + '_1'), { orderId: id, amountClp: 24990 });
  assert.deepEqual(f.counts(), { checkouts: 1, simulations: 1 }); assert.ok(f.calls.length <= 20);
  for (const [i, c] of f.calls.entries()) if (c.method === 'POST') assert.equal(f.calls[i - 1].route, '/api/performance/status');
});
test('aislamiento inválido bloquea todo POST; timeout no duplica checkout; proveedor ajeno bloquea simulación', () => {
  const unsafe = fixture({ badMarker: true }); assert.throws(() => purchaseFlow(unsafe.transport, plan, account, id + '_1')); assert.equal(unsafe.calls.filter(c => c.method === 'POST').length, 0);
  const timeout = fixture({ timeout: true }); assert.throws(() => purchaseFlow(timeout.transport, plan, account, id + '_1'), /UNCERTAIN/); assert.deepEqual(timeout.counts(), { checkouts: 1, simulations: 0 });
  const provider = fixture({ foreignProvider: true }); assert.throws(() => purchaseFlow(provider.transport, plan, account, id + '_1'), /PROVIDER/); assert.equal(provider.counts().simulations, 0);
});
test('inspección del runner rechaza puertos públicos, proveedor incorrecto y PostgreSQL publicado', () => {
  const make = (): PurchaseContainer[] => [{ Name: '/autoparts-purchase-app', State: { Running: true, Health: { Status: 'healthy' } }, Config: { Labels: { 'autoparts.scope': 'purchase-test' }, Env: Object.entries(env).map(([k, v]) => k + '=' + v) }, NetworkSettings: { Ports: { '3000/tcp': [{ HostIp: '127.0.0.1', HostPort: '3102' }] }, Networks: { 'autoparts-purchase_lab': {} } } }, { Name: '/autoparts-purchase-postgres', State: { Running: true, Health: { Status: 'healthy' } }, Config: { Labels: { 'autoparts.scope': 'purchase-test' }, Env: ['POSTGRES_DB=autoparts_purchase_test'] }, NetworkSettings: { Ports: {}, Networks: { 'autoparts-purchase_lab': {} } } }];
  validatePurchaseContainers(make(), id);
  const publicPort = make(); publicPort[0].NetworkSettings.Ports['3000/tcp']![0].HostIp = '0.0.0.0'; assert.throws(() => validatePurchaseContainers(publicPort, id));
  const wrong = make(); wrong[0].Config.Env.push('PAYMENT_PROVIDER=webpay_integration'); assert.throws(() => validatePurchaseContainers(wrong, id));
  const publishedPg = make(); publishedPg[1].NetworkSettings.Ports['5432/tcp'] = [{ HostIp: '127.0.0.1', HostPort: '5544' }]; assert.throws(() => validatePurchaseContainers(publishedPg, id));
});
test('CLI plan es offline; ejecución sin consentimiento y flags peligrosos se rechazan antes de servicios', () => {
  const run = (args: string[]) => spawnSync(process.execPath, ['--import', 'tsx', 'scripts/run-purchase-performance.ts', ...args], { encoding: 'utf8', env: { ...process.env, DOCKER_BIN: 'not-installed-offline', K6_BIN: 'not-installed-offline' } });
  const result = run(['plan', '--environment-id', id]); assert.equal(result.status, 0); assert.equal(JSON.parse(result.stdout).dryRun, true);
  for (const args of [['run'], ['run', '--execute'], ['plan', '--base-url', 'https://remote.invalid'], ['plan', '--environment-id', id, '--vus', '500'], ['plan', '--environment-id', id, '--execute']]) assert.notEqual(run(args).status, 0);
  const source = readFileSync('performance/k6/purchase-journey.js', 'utf8'); assert.equal((source.match(/http\.(request|get|post|batch)\(/g) || []).length, 1); assert.match(source, /PURCHASE_RUNNER_REQUIRED/); assert.match(source, /redirects: 0/);
  for (const f of ['performance/k6/journeys.js', 'performance/k6/purchase-journey.js', 'performance/k6/purchase-flow.js']) assert.doesNotMatch(readFileSync(f, 'utf8'), /google-analytics|googletagmanager|GA_API_SECRET|api_secret=/);
});

test('adaptador k6 se ejecuta solo con dobles: sin red, un checkout y una simulación', async () => {
  const require = createRequire(import.meta.url);
  const { build } = createRequire(require.resolve('tsx/package.json'))('esbuild') as typeof import('esbuild');
  const bundle = await build({ entryPoints: ['performance/k6/purchase-journey.js'], bundle: true, write: false, format: 'iife', globalName: 'Journey',
    plugins: [{ name: 'offline-k6', setup(builder) {
      builder.onResolve({ filter: /^k6\// }, args => ({ path: args.path, namespace: 'offline' }));
      builder.onLoad({ filter: /.*/, namespace: 'offline' }, args => ({ loader: 'js', contents:
        args.path === 'k6/http' ? 'export default {cookieJar(){return {set(){}}},request(method,url,payload,params){const body=typeof payload==="string"?JSON.parse(payload):payload;return {...__transport(method,new URL(url).pathname,body,params.headers),headers:{}}}}' :
        args.path === 'k6/execution' ? 'export default {vu:{idInTest:1,iterationInScenario:0},test:{abort(){throw new Error("ABORTED_OFFLINE")}}}' :
        'class Metric {add(){}}; export {Metric as Counter,Metric as Rate,Metric as Trend};' }));
    } }],
  });
  const live = { ...plan, createdAt: Date.now(), deadline: Date.now() + 90000 };
  live.deadline = live.createdAt + 90000;
  const f = fixture();
  const context = { URL, Date, __transport: ((method, route, body, headers) => f.transport(method, route, body ? JSON.parse(JSON.stringify(body)) : undefined, headers ? JSON.parse(JSON.stringify(headers)) : undefined)) as PurchaseTransport, __ENV: { PURCHASE_PLAN: 'fixture', PURCHASE_RUNNER_READY: 'local-inspection-passed', PURCHASE_ACCOUNTS: JSON.stringify([{email:account.email,sessionCookies:[{name:'fixture',value:'fixture'}]}]) }, open: () => JSON.stringify(live), Journey: undefined as unknown };
  assert.throws(() => runInNewContext(bundle.outputFiles[0].text, { ...context, __ENV: {} }), /PURCHASE_RUNNER_REQUIRED/);
  assert.equal(f.calls.length, 0);
  runInNewContext(bundle.outputFiles[0].text, context);
  (context.Journey as { default(): void }).default();
  assert.deepEqual(f.counts(), { checkouts: 1, simulations: 1 });
});
