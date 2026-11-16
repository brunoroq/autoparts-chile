import http from 'k6/http';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import { purchaseFlow } from './purchase-flow.js';
import { validatePurchasePlan, allowedPurchaseRequest, purchaseBudget } from './purchase-policy.js';

if (!__ENV.PURCHASE_PLAN || __ENV.PURCHASE_RUNNER_READY !== 'local-inspection-passed') throw new Error('PURCHASE_RUNNER_REQUIRED');
const plan = validatePurchasePlan(JSON.parse(open(__ENV.PURCHASE_PLAN)));
function readAccounts() {
  try { return JSON.parse(__ENV.PURCHASE_ACCOUNTS || 'null'); }
  catch { throw new Error('PURCHASE_ACCOUNTS_REQUIRED'); }
}
const accounts = readAccounts();
if (!Array.isArray(accounts) || accounts.length !== plan.vus || new Set(accounts.map(a => a.email)).size !== plan.vus ||
    accounts.some(a => typeof a.email !== 'string' || !Array.isArray(a.sessionCookies) || !a.sessionCookies.length)) throw new Error('PURCHASE_ACCOUNTS_REQUIRED');
const completed = new Counter('purchases_completed');
const failures = new Rate('purchase_failures');
const journeyMs = new Trend('purchase_journey_ms', true);
const dbMs = new Trend('purchase_db_ms', true);
const appMs = new Trend('purchase_app_ms', true);
const providerMs = new Trend('purchase_provider_ms', true);
const statusCount = new Counter('purchase_http_status');
let sent = 0;
export const options = {
  scenarios: { purchase: { executor: 'per-vu-iterations', vus: plan.vus, iterations: Math.ceil(plan.maxPurchases / plan.vus), maxDuration: plan.seconds + 's', gracefulStop: '0s' } },
  maxRedirects: 0,
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'min', 'max', 'count'],
  tags: { workload: 'purchase', experiment: plan.runId, traffic: 'synthetic' },
  thresholds: { purchase_failures: [{ threshold: 'rate==0', abortOnFail: true }], http_req_failed: ['rate==0'] },
};
function request(method, route, body, headers = {}) {
  validatePurchasePlan(plan);
  if (!allowedPurchaseRequest(method, route) || sent >= purchaseBudget(plan, exec.vu.idInTest)) throw new Error('PURCHASE_REQUEST_REJECTED');
  sent++;
  const form = route === '/api/auth/callback/credentials';
  const payload = body ? (form ? body : JSON.stringify(body)) : null;
  const response = http.request(method, plan.baseUrl + route, payload, {
    redirects: 0, timeout: Math.max(1, Math.min(5000, plan.deadline - Date.now())) + 'ms',
    headers: { Origin: plan.baseUrl, ...(form ? {} : { 'Content-Type': 'application/json' }), ...headers },
    tags: { name: route.replace(/\/[a-f0-9-]{36}/g, '/[id]'), workload: 'purchase', phase: route.startsWith('/api/auth/') ? 'authentication' : 'transaction' },
  });
  statusCount.add(1, { status: String(response.status), kind: response.status === 0 || response.status >= 500 ? 'technical' : response.status === 409 ? 'business_conflict' : response.status >= 400 ? 'client_error' : 'success' });
  for (const [label, metric] of [['db', dbMs], ['app', appMs], ['provider', providerMs]]) {
    const match = new RegExp('(?:^|,\\s*)' + label + ';dur=([0-9.]+)').exec(response.headers['Server-Timing'] || '');
    if (match) metric.add(Number(match[1]));
  }
  return response;
}
export default function journey() {
  const ordinal = exec.vu.iterationInScenario * plan.vus + exec.vu.idInTest;
  if (ordinal > plan.maxPurchases) return;
  const start = Date.now();
  try {
    for (const c of accounts[exec.vu.idInTest - 1].sessionCookies) http.cookieJar().set(plan.baseUrl, c.name, c.value, { path: '/' });
    purchaseFlow(request, plan, accounts[exec.vu.idInTest - 1], plan.runId + '_' + ordinal);
    completed.add(1); failures.add(false); journeyMs.add(Date.now() - start);
  } catch {
    failures.add(true);
    // No imprimir respuestas, credenciales ni URLs; no repetir POST incierto.
    exec.test.abort('PURCHASE_STOPPED_NO_RETRY');
  }
}
export function handleSummary(data) {
  return { stdout: JSON.stringify({ experiment: plan.runId, workload: 'purchase', metrics: data.metrics }) + '\n' };
}
