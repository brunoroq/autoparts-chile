import http from 'k6/http';
import { check, sleep } from 'k6';
import exec from 'k6/execution';
import { Counter, Rate, Trend } from 'k6/metrics';
import { buildScenario } from './scenarios.js';
import { BASE_URL, validatePlan, allowedRequest, requestBudget } from './safety.js';
import { summaryFiles } from './summary.js';

// Sin plan privado emitido por el comando principal no se inicializa el generador.
if (!__ENV.PERF_PLAN) throw new Error('Ejecución directa bloqueada: falta PERF_PLAN.');
const plan = validatePlan(JSON.parse(open(__ENV.PERF_PLAN)));
const statuses = new Counter('http_status');
const failures = new Rate('functional_errors');
const db = new Trend('server_db_ms', true);
const app = new Trend('server_app_ms', true);
let sent = 0;
export const options = {
  scenarios: { workload: buildScenario(plan) },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'min', 'max', 'count'],
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' }],
    functional_errors: [{ threshold: 'rate<0.05', abortOnFail: true, delayAbortEval: '30s' }],
    http_req_duration: [{ threshold: 'p(95)<5000', abortOnFail: true, delayAbortEval: '30s' }],
    'http_req_duration{phase:steady}': ['p(95)<5000'],
  },
  tags: { experiment: plan.runId, profile: plan.profile, catalog: String(plan.catalogSize), traffic: 'synthetic' },
  maxRedirects: 0,
};
function guard() {
  try { validatePlan(plan); } catch { exec.test.abort('Plan vencido o inválido.'); }
  if (exec.vu.idInTest > plan.maxVus || exec.instance.vusActive > plan.maxVus || sent >= requestBudget(plan.maxRequests, plan.maxVus, exec.vu.idInTest)) {
    exec.test.abort('Límite de usuarios, tiempo o solicitudes alcanzado.');
  }
}
function request(method, route, payload) {
  guard();
  if (!allowedRequest(method, route)) exec.test.abort('Operación fuera de la lista permitida.');
  if (method === 'POST' && (!payload?.items?.length || payload.items.some(i => i.quantity !== 1))) exec.test.abort('Cotización inválida.');
  sent++;
  const elapsed = (Date.now() - exec.scenario.startTime) / 1000;
  const window = plan.profile === 'baja' ? [30, 150] : plan.profile === 'normal' ? [60, 360] : [90, 150];
  const phase = elapsed >= window[0] && elapsed < window[1] ? 'steady' : 'ramp';
  const response = http.request(method, BASE_URL + route, payload ? JSON.stringify(payload) : null, {
    redirects: 0, timeout: '5s', tags: { phase, name: route.split('?')[0].replace(/\/products\/[a-f0-9-]{36}$/, '/products/[id]').replace(/\/productos\/.+$/, '/productos/[slug]') },
    headers: { Origin: BASE_URL, 'Content-Type': 'application/json', 'X-Experiment-Id': plan.runId },
  });
  statuses.add(1, { status: String(response.status), kind: response.status >= 500 || response.status === 0 ? 'technical' : response.status >= 400 ? 'unexpected_client' : 'success' });
  const ok = check(response, { 'HTTP 200': r => r.status === 200 });
  failures.add(!ok);
  if ([301, 302, 303, 307, 308].includes(response.status)) exec.test.abort('Redirección inesperada; no se siguió el destino.');
  for (const [name, metric] of [['db', db], ['app', app]]) {
    const match = new RegExp(`${name};dur=([0-9.]+)`).exec(response.headers['Server-Timing'] || '');
    if (match) metric.add(Number(match[1]));
  }
  return response;
}
function json(response) {
  try { return response.json(); } catch { failures.add(true); return null; }
}
// La verificación se repite por VU; --no-setup no permite omitir el aislamiento.
let verified = false;
export default function journey() {
  guard();
  if (!verified) {
    const marker = json(request('GET', '/api/performance/status'));
    if (marker?.runId !== plan.runId || marker?.catalogSize !== plan.catalogSize || marker?.isolated !== true) exec.test.abort('Instancia aislada no confirmada.');
    verified = true;
  }
  const n = (exec.vu.idInTest * 17 + exec.vu.iterationInScenario) % 10;
  const pause = () => sleep(1 + (exec.vu.idInTest + exec.vu.iterationInScenario) % 3);
  if (n < 4) { request('GET', '/'); pause(); request('GET', '/catalogo'); }
  const terms = ['LED', 'limpieza', 'zz_sin_resultados'];
  const query = n < 8 && n >= 4 ? `?q=${terms[exec.vu.iterationInScenario % 3]}&minPrice=0&maxPrice=100000&sort=price_asc&page=1&pageSize=12` : '?pageSize=12';
  const list = json(request('GET', '/api/v1/products' + query));
  const products = list?.data;
  failures.add(!Array.isArray(products));
  if (!Array.isArray(products)) return;
  if (n >= 4 && n < 8) {
    const categories = json(request('GET', '/api/v1/categories'));
    const slug = categories?.data?.[exec.vu.iterationInScenario % 6]?.slug;
    if (slug) request('GET', `/api/v1/products?category=${encodeURIComponent(slug)}&sort=price_desc&page=2&pageSize=12`);
  }
  const product = products.find(p => p.stock > 1);
  if (product) {
    pause();
    request('GET', `/api/v1/products/${product.id}`);
    if (n < 4) request('GET', `/productos/${product.slug}`);
    if (n >= 8) {
      const quote = json(request('POST', '/api/v1/cart/guest', { items: [{ productId: product.id, quantity: 1 }] }));
      failures.add(!check(quote, { 'Cotización CLP coherente': q => q?.data?.currency === 'CLP' && q.data.items.length === 1 && q.data.items[0].quantity === 1 && q.data.totalClp === product.priceClp }));
    }
  }
  pause();
}
export function handleSummary(data) { return summaryFiles(data, plan); }
