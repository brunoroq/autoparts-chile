import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { BASE_URL, validatePlan, allowedRequest, requestBudget } from '../performance/k6/safety.js';
import { profiles, durationSeconds, buildScenario } from '../performance/k6/scenarios.js';
import { summaryFiles } from '../performance/k6/summary.js';
import { performanceIsolation } from '../src/lib/observability/performance-isolation';
import { summarize } from '../scripts/export-metrics';
import { verifyPerformanceEndpoint } from '../scripts/performance-endpoint';

const now = 1900000000000;
const plan = { runId: '12345678-1234-1234-1234-123456789abc', profile: 'baja' as const, model: 'closed' as const, peakRate: 1, baseUrl: BASE_URL, catalogSize: 30, maxVus: 3, maxRequests: 10000, createdAt: now, deadline: now + 210000, output: 'artifacts/test' };
test('planes rechazan remotos, excesos, vencimiento y perfiles incompatibles', () => {
  assert.equal(validatePlan(plan, now), plan);
  for (const change of [{ baseUrl: 'https://autoparts-chile.vercel.app' }, { baseUrl: 'https://example.neon.tech' }, { baseUrl: 'http://localhost:3100' }, { baseUrl: BASE_URL + '@remote.invalid' }, { maxVus: 31 }, { maxVus: 2 }, { maxRequests: 10001 }, { maxRequests: 0 }, { deadline: now }, { deadline: now + 601000 }, { createdAt: now + 1 }, { catalogSize: 31 }, { profile: 'constructor' }]) {
    assert.throws(() => validatePlan({ ...plan, ...change } as typeof plan, now));
  }
});
test('cada escenario queda acotado y el presupuesto particionado no supera 10000', () => {
  for (const stages of Object.values(profiles)) {
    assert.ok(durationSeconds(stages) + 30 <= 600);
    const vus = Math.max(...stages.map(s => s.target));
    const total = Array.from({ length: vus }, (_, i) => requestBudget(10000, vus, i + 1)).reduce((a, b) => a + b, 0);
    assert.ok(total <= 10000);
  }
  assert.equal(requestBudget(10000, 30, 31), 0);
  assert.equal(buildScenario({ ...plan, model: 'arrival', maxVus: 30 }).executor, 'ramping-arrival-rate');
  assert.throws(() => validatePlan({ ...plan, peakRate: 6 }, now));
});
test('lista permitida bloquea pagos, cuentas, redirecciones y otros métodos', () => {
  for (const route of ['/api/v1/orders', '/api/auth/signin', '/api/v1/cart/merge', '/checkout', '//third.invalid', '/api/v1/cart/guest?x=1', '/api/v1/products/../orders', '/api/v1/products\\orders']) {
    assert.equal(allowedRequest('POST', route), false);
    assert.equal(allowedRequest('GET', route), false);
  }
  assert.equal(allowedRequest('POST', '/api/v1/cart/guest'), true);
  assert.equal(allowedRequest('GET', '/api/v1/products?q=LED&page=2'), true);
  assert.equal(allowedRequest('DELETE', '/api/v1/cart/guest'), false);
});
test('marcador requiere base exclusiva, sintéticos y Analytics apagado', () => {
  assert.equal(performanceIsolation({}), null);
  const env = { PERF_ISOLATED: 'true', DATABASE_URL: 'postgresql://fixture:fixture@postgres:5432/autoparts_performance_test', NEXTAUTH_URL: BASE_URL, ANALYTICS_ENABLED: 'false', TRAFFIC_KIND: 'synthetic', PAYMENT_PROVIDER: 'simulated', EXPERIMENT_ID: plan.runId, CATALOG_SIZE: '30' };
  assert.equal(performanceIsolation(env)?.isolated, true);
  for (const change of [{ DATABASE_URL: 'postgresql://fixture:fixture@ep-example.neon.tech/neondb' }, { DIRECT_URL: 'postgresql://fixture:fixture@ep-example.neon.tech/neondb' }, { DATABASE_URL: 'https://postgres:5432/autoparts_performance_test' }, { ANALYTICS_ENABLED: 'true' }, { VERCEL: '1' }, { PAYMENT_PROVIDER: 'webpay' }, { TRAFFIC_KIND: 'human' }]) assert.throws(() => performanceIsolation({ ...env, ...change }));
});
test('exportación conserva percentiles y throughput sin inventar duración', () => {
  const rows = Array.from({ length: 100 }, (_, i) => ({ event: 'api_request', totalMs: i + 1, status: 200 }));
  const result = summarize(rows, 10)[0];
  assert.equal(result.p90Ms, 90); assert.equal(result.p95Ms, 95); assert.equal(result.p99Ms, 99); assert.equal(result.throughputRps, 10);
  const files = summaryFiles({ metrics: { http_req_duration: { values: { avg: 50, 'p(90)': 90, 'p(95)': 95, 'p(99)': 99 } } } }, plan);
  assert.match(files['artifacts/test/summary.csv'], /p\(90\),90/);
  assert.equal(JSON.parse(files['artifacts/test/summary.json']).plan.runId, plan.runId);
});
test('entrada directa requiere plan y todos los HTTP pasan por wrapper limitado', () => {
  const source = readFileSync('performance/k6/journeys.js', 'utf8');
  assert.match(source, /if \(!__ENV.PERF_PLAN\) throw/);
  assert.equal((source.match(/http\.(request|get|post|batch)\(/g) || []).length, 1);
  assert.match(source, /redirects: 0/);
  assert.match(source, /requestBudget/);
  assert.match(source, /function guard/);
  const dockerignore = readFileSync('.dockerignore', 'utf8');
  assert.match(dockerignore, /\.env\*/); assert.match(dockerignore, /artifacts/);
});
test('CLI en modo plan no inicia procesos de Docker/k6 y rechaza destinos arbitrarios', () => {
  const env = { ...process.env, DOCKER_BIN: 'missing-docker-for-offline-test', K6_BIN: 'missing-k6-for-offline-test' };
  const dry = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/run-performance.ts', 'plan', '--profile', 'normal'], { env, encoding: 'utf8' });
  assert.equal(dry.status, 0);
  assert.equal(JSON.parse(dry.stdout).dryRun, true);
  const blocked = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/run-performance.ts', 'run', '--base-url', 'https://autoparts-chile.vercel.app'], { env, encoding: 'utf8' });
  assert.notEqual(blocked.status, 0);
  assert.match(blocked.stderr, /Argumento desconocido/);
});
test('preparación requiere acceso desde host con UUID/catálogo correctos y sin redirecciones', async () => {
  const marker = { isolated: true, runId: plan.runId, catalogSize: 30 };
  const result = await verifyPerformanceEndpoint(plan.runId, 30, async (url, init) => {
    assert.equal(url, BASE_URL + '/api/performance/status');
    assert.equal(init.redirect, 'error');
    assert.ok(init.signal);
    return Response.json(marker);
  });
  assert.deepEqual(result, marker);
  for (const body of [{ ...marker, runId: 'wrong' }, { ...marker, catalogSize: 1000 }, { ...marker, isolated: false }, null]) {
    await assert.rejects(verifyPerformanceEndpoint(plan.runId, 30, async () => Response.json(body)));
  }
  await assert.rejects(verifyPerformanceEndpoint(plan.runId, 30, async () => Response.json(marker, { status: 503 })));
  await assert.rejects(verifyPerformanceEndpoint(plan.runId, 30, async () => { throw new Error('ECONNREFUSED'); }));
  const source = readFileSync('scripts/run-performance.ts', 'utf8');
  assert.ok(source.indexOf('await verifyPerformanceEndpoint(runId, catalogSize)') < source.indexOf('prepared: true'));
});
