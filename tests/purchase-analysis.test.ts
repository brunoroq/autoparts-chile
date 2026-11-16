import test from 'node:test';
import assert from 'node:assert/strict';
import { purchaseRouteLabel, summarizePurchasePoints } from '../scripts/purchase-analysis';
import { purchaseSessions } from '../scripts/purchase-auth';
import { PURCHASE_URL, type PurchasePlan } from '../performance/k6/purchase-policy.js';

test('posprocesador admite rutas relativas y distingue evidencia absoluta sin inventar origen', () => {
  assert.deepEqual(purchaseRouteLabel('/api/v1/products/[id]'), { route: '/api/v1/products/[id]', destinationEvidence: 'relative_label_only' });
  assert.equal(purchaseRouteLabel(PURCHASE_URL + '/api/v1/checkout').destinationEvidence, 'absolute_metric_label');
  for (const route of ['//google.invalid', 'https://www.google-analytics.com/mp/collect', '/api/v1/checkout?token=x', '/api/../checkout']) assert.throws(() => purchaseRouteLabel(route));
  const rows = ['GET', 'POST'].map(method => JSON.stringify({ type: 'Point', metric: 'http_req_duration', data: { tags: { method, url: method === 'GET' ? '/api/v1/cart' : '/api/v1/checkout', status: '200' } } }));
  assert.equal(summarizePurchasePoints(rows.join('\n')).requests, 2);
});

test('sesiones se preparan secuencialmente con cookies distintas y sin reintentos', async () => {
  const now = Date.now();
  const plan: PurchasePlan = { workload: 'purchase', baseUrl: PURCHASE_URL, environmentId: '12345678-1234-4234-8234-123456789abc', runId: '22345678-1234-4234-8234-123456789abc', paymentProvider: 'SIMULATED', analytics: false, vus: 10, maxPurchases: 10, maxRequests: 500, seconds: 90, createdAt: now, deadline: now + 90000 };
  let calls = 0, active = 0, peak = 0;
  const accounts = Array.from({ length: 10 }, (_, i) => ({ email: 'fixture-' + i + '@example.invalid', password: 'fixture-only-password' }));
  const transport = (async (url, init) => {
    active++; peak = Math.max(peak, active); await new Promise(r => setTimeout(r, 1));
    const index = Math.floor(calls / 4); calls++;
    const route = String(url).slice(PURCHASE_URL.length);
    let value: unknown = { csrfToken: 'fixture' };
    if (route === '/api/performance/status') value = { isolated: true, workload: 'purchase', runId: plan.environmentId, origin: PURCHASE_URL, database: 'autoparts_purchase_test', paymentProvider: 'SIMULATED', analytics: false, measurementId: '', syntheticMeasurementId: '' };
    if (route === '/api/auth/callback/credentials') assert.ok(init?.body instanceof URLSearchParams);
    if (route === '/api/auth/session') value = { user: { id: 'fixture-' + index, email: accounts[index].email } };
    active--; return Response.json(value, { headers: { 'Set-Cookie': 'fixture=session-' + index + '; Path=/' } });
  }) as typeof fetch;
  const result = await purchaseSessions(accounts, plan, transport);
  assert.equal(peak, 1); assert.equal(result.requests, 40); assert.equal(result.sessions.length, 10);
  assert.equal(new Set(result.sessions.map(s => s.sessionCookies[0].value)).size, 10);
  let failures = 0;
  await assert.rejects(purchaseSessions(accounts, plan, (async () => { failures++; throw new Error('fixture timeout'); }) as typeof fetch));
  assert.equal(failures, 1);
});
