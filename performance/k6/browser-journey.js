import { browser } from 'k6/browser';
import exec from 'k6/execution';
import { sleep, check } from 'k6';
import { validateBrowserPlan, browserNetworkAllowed, BROWSER_LIMITS } from './browser-policy.js';
import { browserFlow, browserInit } from './browser-flow.js';

if (!__ENV.PERF_BROWSER_PLAN) throw new Error('Entrada directa bloqueada: falta plan de navegador.');
const plan = validateBrowserPlan(JSON.parse(open(__ENV.PERF_BROWSER_PLAN)));
if (__ENV.K6_BROWSER_ARGS !== `proxy-server=http://127.0.0.1:${plan.proxyPort},proxy-bypass-list=<-loopback>`) {
  throw new Error('Proxy obligatorio ausente.');
}
export const options = {
  scenarios: { observer: { executor: 'shared-iterations', vus: 1, iterations: 1,
    maxDuration: `${plan.delaySeconds + 90}s`, options: { browser: { type: 'chromium' } } } },
  thresholds: { checks: ['rate==1'] },
  summaryTrendStats: ['avg', 'med', 'p(90)', 'p(95)', 'p(99)', 'max'],
  tags: { experiment: plan.runId, traffic: 'synthetic', population: 'browser_observer' },
  systemTags: ['status', 'method', 'scenario'],
};
export default async function observerJourney() {
  validateBrowserPlan(plan);
  if (exec.vu.idInTest !== 1 || exec.instance.vusActive > 1 || exec.vu.iterationInScenario !== 0) exec.test.abort('Solo un observador y un recorrido.');
  sleep(plan.delaySeconds);
  validateBrowserPlan(plan);
  const context = await browser.newContext();
  try {
    context.setDefaultTimeout(15000);
    context.setDefaultNavigationTimeout(15000);
    await context.addInitScript(`(${browserInit.toString()})(${JSON.stringify({ measurementId: plan.measurementId })})`);
    const page = await context.newPage();
    let requests = 0;
    await page.route(/.*/, async route => {
      const req = route.request();
      const headers = req.headers();
      requests++;
      if (requests > BROWSER_LIMITS.requests || Date.now() >= plan.deadline) {
        await route.abort(); exec.test.abort('Límite de solicitudes/tiempo del navegador.'); return;
      }
      if (!browserNetworkAllowed(req.method(), req.url(), req.postData(), plan.measurementId)) {
        if (req.method() === 'GET' && headers['next-router-prefetch'] === '1' && req.url().startsWith(plan.baseUrl + '/')) {
          await route.fulfill({ status: 204, body: '' }); return;
        }
        await route.abort(); exec.test.abort('Destino o ID de Analytics bloqueado.'); return;
      }
      await route.continue();
    });
    await page.goto(plan.baseUrl + '/api/performance/status');
    const body = JSON.parse(await page.locator('body').innerText());
    if (body.runId !== plan.runId || body.catalogSize !== plan.catalogSize || !body.isolated ||
        body.analytics !== true || body.measurementId !== plan.measurementId) exec.test.abort('Aislamiento no confirmado.');
    const result = await browserFlow(page, plan);
    check(result, { 'recorrido invitado y eventos sintéticos válidos': r => r.events.includes('remove_from_cart') });
    // Permitir el transporte normal; no reintentar ni emitir eventos artificiales.
    await page.waitForTimeout(3000);
    console.log(JSON.stringify({ event: 'browser_observer', ...result }));
  } catch {
    check(false, { 'recorrido invitado y eventos sintéticos válidos': v => v });
    throw new Error('BROWSER_JOURNEY_FAILED');
  } finally { await context.close(); }
}
export function handleSummary(data) {
  const metrics = {};
  const rows = ['metric,stat,value'];
  for (const [name, metric] of Object.entries(data.metrics || {})) {
    if (!/^[a-z0-9_]+$/.test(name)) continue;
    const values = {};
    for (const [stat, value] of Object.entries(metric.values || {})) {
      if (/^[a-z0-9(),.]+$/.test(stat) && typeof value === 'number' && Number.isFinite(value)) {
        values[stat] = value; rows.push(`${name},"${stat}",${value}`);
      }
    }
    metrics[name] = values;
  }
  return {
    [__ENV.PERF_BROWSER_PLAN.replace(/plan\.json$/, 'summary.json')]: JSON.stringify({ population: 'browser_observer', experimentId: plan.runId, metrics }, null, 2),
    [__ENV.PERF_BROWSER_PLAN.replace(/plan\.json$/, 'summary.csv')]: rows.join('\n') + '\n',
  };
}
