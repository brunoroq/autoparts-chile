import { browser } from 'k6/browser';
import exec from 'k6/execution';
import { sleep, check } from 'k6';
import { validateBrowserPlan, browserNetworkDecision, diagnosticTarget, BROWSER_LIMITS } from './browser-policy.js';
import { BrowserDiagnostics, browserErrorCode } from './browser-diagnostics.js';
import { browserFlow, browserInit } from './browser-flow.js';
import { attachAnalyticsEvidence } from './browser-evidence.js';

if (!__ENV.PERF_BROWSER_PLAN) throw new Error('Entrada directa bloqueada: falta plan de navegador.');
const plan = validateBrowserPlan(JSON.parse(open(__ENV.PERF_BROWSER_PLAN)));
if (__ENV.K6_BROWSER_ARGS !== `proxy-server=http://127.0.0.1:${plan.proxyPort},proxy-bypass-list=<-loopback>`) {
  throw new Error('Proxy obligatorio ausente.');
}
export const options = {
  scenarios: { observer: { executor: 'shared-iterations', vus: 1, iterations: 1,
    maxDuration: `${plan.delaySeconds + 90}s`, gracefulStop: '0s', options: { browser: { type: 'chromium' } } } },
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
  const diagnostics = new BrowserDiagnostics({measurementId:plan.measurementId, sink:row => console.log(JSON.stringify(row))});
  const diagnose = (code, fields = {}) => diagnostics.record(code, {source:'browser', ...fields});
  let context;
  let wire, reported = false, stage = 'context';
  const reportFailure = () => {
    if (!reported) {
      console.log(JSON.stringify({event:'browser_observer', events:[], verified:false, stage,
        network:wire ? wire.snapshot() : {rows:[], pending:0, failed:true}}));
      reported = true;
    }
  };
  const abort = message => { reportFailure(); exec.test.abort(message); };
  try {
    diagnose('BROWSER_LAUNCH_REQUESTED', {phase:'browser_launch'});
    context = await browser.newContext();
    diagnose('BROWSER_CONTEXT_READY', {phase:'context'});
    context.setDefaultTimeout(15000);
    context.setDefaultNavigationTimeout(15000);
    await context.addInitScript(`(${browserInit.toString()})(${JSON.stringify({ measurementId: plan.measurementId })})`);
    const page = await context.newPage();
    diagnose('BROWSER_PAGE_READY', {phase:'context'});
    wire = attachAnalyticsEvidence(page, plan.measurementId, plan.runId, diagnose);
    page.on('request', req => {
      if (diagnosticTarget(req.url()) === 'google_script') diagnose('GTAG_SCRIPT_REQUESTED', {phase:'gtag_script', target:'google_script'});
    });
    page.on('response', async response => {
      const req = await response.request(), target = diagnosticTarget(req.url());
      if (target === 'google_script') diagnose('GTAG_SCRIPT_HTTP', {phase:'gtag_script', target, httpStatus:response.status()});
      else if (target.startsWith('local_')) diagnose('LOCAL_HTTP_RESPONSE', {target, httpStatus:response.status()});
    });
    page.on('requestfailed', req => {
      if (diagnosticTarget(req.url()) === 'google_script') diagnose('GTAG_SCRIPT_FAILED', {phase:'gtag_script', target:'google_script', fatal:true});
    });
    stage = 'network_policy';
    let requests = 0;
    await page.route(/.*/, async route => {
      const req = route.request();
      const headers = req.headers();
      requests++;
      if (requests > BROWSER_LIMITS.requests || Date.now() >= plan.deadline) {
        diagnose('NETWORK_LIMIT_STOP', {requests, reason:requests > BROWSER_LIMITS.requests ? 'REQUEST_LIMIT' : 'DEADLINE_EXCEEDED', fatal:true});
        await route.abort(); abort('Límite de solicitudes/tiempo del navegador.'); return;
      }
      const decision = browserNetworkDecision(req.method(), req.url(), req.postData(), plan.measurementId);
      if (!decision.allowed || !wire.allowed(req)) {
        if (req.method() === 'GET' && headers['next-router-prefetch'] === '1' && req.url().startsWith(plan.baseUrl + '/')) {
          await route.fulfill({ status: 204, body: '' }); return;
        }
        diagnose('NETWORK_POLICY_BLOCKED', {phase:'network_policy', target:diagnosticTarget(req.url()), method:req.method(), reason:decision.allowed ? 'LABELS_OR_PAYLOAD_INVALID' : decision.reason, fatal:true});
        await route.abort(); abort('Destino o ID de Analytics bloqueado.'); return;
      }
      await route.continue();
    });
    stage = 'isolation';
    diagnose('LOCAL_NAVIGATION_STARTED', {phase:'local_navigation', target:'local_isolation'});
    await page.goto(plan.baseUrl + '/api/performance/status');
    const body = JSON.parse(await page.locator('body').innerText());
    if (body.runId !== plan.runId || body.catalogSize !== plan.catalogSize || !body.isolated ||
        body.analytics !== true || body.measurementId !== plan.measurementId || body.observer !== true || body.origin !== plan.baseUrl) abort('Aislamiento no confirmado.');
    const result = await browserFlow(page, plan, step => {
      stage = step;
      if (step === 'consent') diagnose('CONSENT_ACTION_REQUESTED', {phase:'consent'});
      else diagnose('LOCAL_NAVIGATION_STARTED', {phase:'local_navigation'});
    }, async (name, count) => {
      // Confirmar transporte antes de abandonar una página: evita perder un
      // evento pendiente por navegación rápida. No se reenvía ninguna solicitud.
      for (let n = 0; n < 20; n++) {
        if (wire.state.failed || wire.state.rows.some(r => !r.httpSuccess)) throw new Error('TRANSPORT_FAILED');
        if (wire.state.rows.filter(r => r.event === name && r.httpSuccess).length >= count) return;
        await page.waitForTimeout(250);
      }
      throw new Error('TRANSPORT_NOT_CONFIRMED_BEFORE_NAVIGATION');
    }, diagnose);
    stage = 'transport';
    // Espera acotada de transporte sin repetir eventos, POST o el recorrido.
    const required = ['page_view', 'view_item', 'add_to_cart', 'remove_from_cart'];
    for (let n = 0; n < 10; n++) {
      if (required.every(name => wire.state.rows.some(r => r.event === name && r.httpSuccess)) && wire.state.pending === 0) break;
      await page.waitForTimeout(500);
    }
    const network = wire.snapshot();
    const delivered = !network.failed && required.every(name => network.rows.some(r => r.event === name && r.httpSuccess)) &&
      network.rows.every(r => r.measurementId === plan.measurementId && r.labelsVerified && r.httpSuccess) && network.pending === 0 &&
      network.rows.filter(r => r.event === 'page_view').length === 4 &&
      ['view_item','add_to_cart','remove_from_cart'].every(name => network.rows.filter(r => r.event === name).length === 1);
    check(result, { 'recorrido y transporte HTTP sintético verificados': () => delivered });
    console.log(JSON.stringify({ event: 'browser_observer', ...result, network, verified: delivered, stage }));
    reported = true;
    if (!delivered) throw new Error('GOOGLE_TRANSPORT_UNCONFIRMED');
  } catch (error) {
    diagnose('BROWSER_ACTION_FAILED', {reason:browserErrorCode(error), fatal:true});
    reportFailure();
    check(false, { 'recorrido invitado y eventos sintéticos válidos': v => v });
    throw new Error('BROWSER_JOURNEY_FAILED');
  } finally { if (context) await context.close(); }
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
