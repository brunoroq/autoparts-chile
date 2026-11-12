import { execFileSync, spawn } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { profiles, durationSeconds, limits } from '../performance/k6/scenarios.js';
import { BASE_URL, validatePlan } from '../performance/k6/safety.js';
import { exportMetrics } from './export-metrics';
import { verifyPerformanceEndpoint } from './performance-endpoint';
import { validSyntheticId } from '../src/lib/analytics/synthetic';
import { browserProxy } from './performance-browser-proxy';
import { BROWSER_LIMITS, validateBrowserPlan } from '../performance/k6/browser-policy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docker = process.env.DOCKER_BIN || (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'Programs/DockerDesktop/resources/bin/docker.exe') : 'docker');
const k6 = process.env.K6_BIN || (process.platform === 'win32' ? 'C:/Program Files/k6/k6.exe' : 'k6');
const args = process.argv.slice(2), action = args.shift();
const value = (flag: string, fallback: string) => { const i = args.indexOf(flag); return i < 0 ? fallback : args[i + 1]; };
const runId = value('--run-id', randomUUID());
const profile = value('--profile', 'baja') as keyof typeof profiles;
const catalogSize = Number(value('--catalog', '30'));
const model = value('--model', 'closed') as 'closed' | 'arrival';
const peakRate = Number(value('--rate', '1'));
const execute = args.includes('--execute');
const withBrowser = args.includes('--browser');
const browserOnly = args.includes('--observer-only');
const syntheticId = value('--synthetic-id', '');
const allowed = ['--run-id', '--profile', '--catalog', '--model', '--rate', '--execute', '--browser', '--observer-only', '--synthetic-id'];
for (let i = 0; i < args.length; i++) {
  if (!allowed.includes(args[i])) throw new Error('Argumento desconocido.');
  if (!['--execute', '--browser', '--observer-only'].includes(args[i])) { if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Falta valor.'); i++; }
}
if ((withBrowser && (!validSyntheticId(syntheticId, process.env.GA4_MEASUREMENT_ID) || model !== 'closed' || action === 'prepare')) ||
    (!withBrowser && (syntheticId || browserOnly))) throw new Error('El observador requiere --browser --synthetic-id G-ID_LAB, modelo closed y destino separado.');
if (!['plan', 'prepare', 'run'].includes(action || '') || !/^[a-f0-9-]{36}$/.test(runId) || !Object.hasOwn(profiles, profile) || ![30, 1000, 10000].includes(catalogSize) || !['closed', 'arrival'].includes(model) || !Number.isInteger(peakRate) || peakRate < 1 || peakRate > 5) throw new Error('Uso: perf -- plan|prepare|run [--run-id UUID] [--profile baja|normal|pico] [--catalog 30|1000|10000] [--model closed|arrival] [--rate 1..5 recorridos/s] [--execute]');
const directory = path.join(root, 'artifacts/performance', runId);
const envFile = path.join(directory, 'compose.env');
const lockFile = path.join(root, 'artifacts/performance/active.lock');
let ownsLock = false;
let stage = 'arguments';
const compose = ['compose', '--project-name', 'autoparts-performance', '--file', path.join(root, 'compose.performance.yaml'), '--env-file', envFile];
// No se cargan .env del repositorio ni variables DATABASE_URL del shell.
const cleanEnv = { ...process.env };
for (const key of Object.keys(cleanEnv)) if (/^(PERF_|K6_|GA4_|ANALYTICS_|DATABASE_URL$|DIRECT_URL$|COMPOSE_)/.test(key)) delete cleanEnv[key];
cleanEnv.K6_NO_USAGE_REPORT = 'true';
let restoreAnalytics: (() => void) | undefined;
let closeProxy: (() => Promise<void>) | undefined;
const children: ReturnType<typeof spawn>[] = [];
const call = (binary: string, commands: string[], timeout = 15000) => execFileSync(binary, commands, { cwd: root, env: cleanEnv, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout, maxBuffer: 64 * 1024 * 1024 });
function readiness() {
  const info = JSON.parse(call(docker, ['info', '--format', '{{json .}}']));
  if (info.OSType !== 'linux' || info.NCPU < 4 || info.MemTotal < 6 * 1024 ** 3 || os.freemem() < 2 * 1024 ** 3) throw new Error('Docker Linux requiere al menos 4 CPU, 6 GiB asignados y 2 GiB libres en el host.');
  const version = call(k6, ['version']);
  if (!version.includes('v2.3.0')) throw new Error('Se requiere k6 v2.3.0 para reproducibilidad.');
  return { dockerCpus: info.NCPU, dockerMemoryBytes: info.MemTotal, dockerVersion: info.ServerVersion, k6: version.trim(), hostCpus: os.cpus().length, hostMemoryBytes: os.totalmem() };
}
async function main() {
  if (action === 'plan' || !execute) {
    console.log(JSON.stringify({ dryRun: true, action, runId, baseUrl: BASE_URL, profile, model, peakRate, catalogSize, stages: profiles[profile], limits, browser: withBrowser ? { observers: 1, journeys: 1, httpWorkload: !browserOnly, measurementId: syntheticId, limits: BROWSER_LIMITS } : false, message: 'Sin solicitudes HTTP, contenedores, migraciones ni carga. prepare/run requieren --execute y autorización.' }, null, 2));
    return;
  }
  stage = 'requirements';
  const resources = readiness();
  mkdirSync(path.dirname(lockFile), { recursive: true });
  writeFileSync(lockFile, JSON.stringify({ pid: process.pid, runId }), { flag: 'wx' });
  ownsLock = true;
  if (action === 'prepare') {
    // No sustituir silenciosamente un laboratorio anterior del mismo proyecto.
    if (call(docker, ['ps', '-aq', '--filter', 'label=com.docker.compose.project=autoparts-performance']).trim()) throw new Error('Ya existe laboratorio; detener y revisar manualmente antes de preparar otro.');
    mkdirSync(path.dirname(directory), { recursive: true });
    mkdirSync(directory, { recursive: false });
    const local = { PERF_DB_PASSWORD: randomBytes(24).toString('hex'), PERF_AUTH_SECRET: randomBytes(32).toString('hex'), PERF_PAYMENT_SECRET: randomBytes(32).toString('hex'), PERF_RUN_ID: runId, PERF_EXPERIMENT_ID: runId, PERF_CATALOG_SIZE: String(catalogSize), PERF_CONCURRENCY: 'unspecified' };
    writeFileSync(envFile, Object.entries(local).map(([k, v]) => `${k}=${v}`).join('\n'), { flag: 'wx', mode: 0o600 });
    writeFileSync(path.join(directory, 'configuration.json'), JSON.stringify({ runId, catalogSize, resources }, null, 2), { flag: 'wx' });
    stage = 'build-isolated-image';
    call(docker, [...compose, 'build'], 900000);
    stage = 'prepare-isolated-database';
    call(docker, [...compose, 'up', '-d', '--wait', 'postgres'], 180000);
    call(docker, [...compose, 'run', '--rm', '--no-deps', 'prepare'], 180000);
    call(docker, [...compose, 'up', '-d', '--wait', 'app'], 180000);
    stage = 'verify-prepared-instance-from-host';
    await verifyPerformanceEndpoint(runId, catalogSize);
    console.log(JSON.stringify({ prepared: true, runId, catalogSize, next: `npm run perf -- run --run-id ${runId} --profile baja --execute` }));
    return;
  }
  if (!args.includes('--run-id') || !existsSync(envFile)) throw new Error('Usar el UUID del entorno preparado.');
  const local = parse(readFileSync(envFile));
  const config = JSON.parse(readFileSync(path.join(directory, 'configuration.json'), 'utf8'));
  if (local.PERF_RUN_ID !== runId || Number(local.PERF_CATALOG_SIZE) !== config.catalogSize) throw new Error('Configuración local inconsistente.');
  if (args.includes('--catalog') && catalogSize !== config.catalogSize) throw new Error('El tamaño solicitado no coincide con el laboratorio preparado.');
  const output = path.join(directory, `${profile}-${model}${withBrowser ? browserOnly ? '-browser-baseline' : '-browser' : ''}`);
  mkdirSync(output, { recursive: false }); // No sobrescribir ni repetir una condición accidentalmente.
  const maxVus = model === 'arrival' ? 30 : Math.max(...profiles[profile].map(s => s.target));
  const experimentId = randomUUID();
  local.PERF_CONCURRENCY = String(maxVus);
  local.PERF_EXPERIMENT_ID = experimentId;
  local.PERF_BROWSER_ANALYTICS = withBrowser ? 'true' : 'false';
  local.PERF_GA4_SYNTHETIC_MEASUREMENT_ID = withBrowser ? syntheticId : '';
  if (withBrowser) restoreAnalytics = () => {
    local.PERF_BROWSER_ANALYTICS = 'false'; local.PERF_GA4_SYNTHETIC_MEASUREMENT_ID = '';
    writeFileSync(envFile, Object.entries(local).map(([k, v]) => `${k}=${v}`).join('\n'), { mode: 0o600 });
    call(docker, [...compose, 'up', '-d', '--wait', 'app'], 180000);
  };
  writeFileSync(envFile, Object.entries(local).map(([k, v]) => `${k}=${v}`).join('\n'), { mode: 0o600 });
  call(docker, [...compose, 'up', '-d', '--wait', 'app'], 180000);
  // Comprobar la instancia antes de emitir el plan; no seguir redirecciones.
  stage = 'verify-isolated-instance';
  await verifyPerformanceEndpoint(experimentId, config.catalogSize);
  const seconds = browserOnly ? 90 : durationSeconds(profiles[profile]);
  const createdAt = Date.now();
  // Reservar la comprobación HTTP del comando principal dentro del límite total.
  const plan = validatePlan({ runId: experimentId, baseUrl: BASE_URL, profile, model, peakRate, catalogSize: config.catalogSize, maxVus, maxRequests: limits.maxRequests - 1 - (withBrowser ? BROWSER_LIMITS.requests : 0), createdAt, deadline: createdAt + (durationSeconds(profiles[profile]) + 30) * 1000, output: output.replaceAll('\\', '/') });
  const planFile = path.join(output, 'plan.json');
  writeFileSync(planFile, JSON.stringify(plan, null, 2), { flag: 'wx' });
  writeFileSync(path.join(output, 'manifest.json'), JSON.stringify({ ...config, resources, plan, browser: withBrowser ? { observers: 1, journeys: 1, httpWorkload: !browserOnly, measurementId: syntheticId } : false, commit: call('git', ['rev-parse', 'HEAD']).trim(), dirty: !!call('git', ['status', '--porcelain']).trim(), warmup: 'Ramp-up incluido; analizar meseta por separado', startedAt: new Date(createdAt).toISOString() }, null, 2), { flag: 'wx' });
  const samples = Math.ceil((seconds + 15) / 5);
  const observer = spawn(process.execPath, ['--import', 'tsx', 'scripts/observe-docker.ts', String(samples), '--performance', envFile], { cwd: root, env: { ...cleanEnv, DOCKER_BIN: docker, DOCKER_SAMPLE_MS: '5000', EXPERIMENT_ID: experimentId, APP_ENV: 'performance-local', TRAFFIC_KIND: 'synthetic', CATALOG_SIZE: String(config.catalogSize), EXPERIMENT_CONCURRENCY: String(maxVus) }, stdio: ['ignore', 'pipe', 'pipe'] });
  const observerClosed = new Promise<void>(resolve => observer.once('close', () => resolve()));
  children.push(observer);
  let observations = '';
  observer.stdout.on('data', b => { observations += String(b); });
  let observerFailed = false;
  stage = 'k6-local-execution';
  let browserChild: ReturnType<typeof spawn> | undefined;
  let browserFailed = false;
  let browserEvidence = '';
  let proxy: Awaited<ReturnType<typeof browserProxy>> | undefined;
  let browserPlanFile = '';
  if (withBrowser) {
    proxy = await browserProxy(createdAt + (seconds + 30) * 1000, () => { browserFailed = true; browserChild?.kill(); });
    closeProxy = proxy.close;
    const browserPlan = validateBrowserPlan({ baseUrl: BASE_URL, measurementId: syntheticId, proxyPort: proxy.port, runId: experimentId,
      catalogSize: config.catalogSize, createdAt, deadline: createdAt + (seconds + 30) * 1000,
      delaySeconds: browserOnly ? 0 : profile === 'baja' ? 30 : profile === 'normal' ? 60 : 90 });
    mkdirSync(path.join(output, 'browser'));
    browserPlanFile = path.join(output, 'browser/plan.json');
    writeFileSync(browserPlanFile, JSON.stringify(browserPlan, null, 2), { flag: 'wx' });
    cleanEnv.K6_BROWSER_ARGS = `proxy-server=http://127.0.0.1:${proxy.port},proxy-bypass-list=<-loopback>`;
    cleanEnv.K6_BROWSER_HEADLESS = 'true';
    cleanEnv.K6_LOG_FORMAT = 'json';
  }
  // Las URLs de collect contienen IDs efímeros: del navegador solo se exportan
  // agregados numéricos saneados, nunca muestras de red con query strings.
  const browserArgs = ['run', '-e', `K6_BROWSER_ARGS=${cleanEnv.K6_BROWSER_ARGS || ''}`, '-e', `PERF_BROWSER_PLAN=${browserPlanFile}`, 'performance/k6/browser-journey.js'];
  const child = spawn(k6, browserOnly ? browserArgs : ['run', '--out', `json=${path.join(output, 'k6.jsonl')}`, '--out', `csv=${path.join(output, 'k6.csv')}`, '-e', `PERF_PLAN=${planFile}`, 'performance/k6/journeys.js'], { cwd: root, env: cleanEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  if (withBrowser) {
    browserChild = browserOnly ? child : spawn(k6, browserArgs, { cwd: root, env: cleanEnv, stdio: ['ignore', 'pipe', 'pipe'] });
    if (!browserOnly) children.push(browserChild);
    browserChild.stderr?.on('data', b => { browserEvidence += String(b); if (browserEvidence.length > 256000) browserEvidence = browserEvidence.slice(-256000); });
    if (!browserOnly) browserChild.stdout?.resume();
  }
  const browserClosed = browserChild ? new Promise<number | null>(resolve => {
    browserChild!.once('exit', code => { if (code !== 0) { browserFailed = true; child.kill(); } resolve(code); });
    browserChild!.once('error', () => { browserFailed = true; child.kill(); resolve(null); });
  }) : Promise.resolve(0);
  observer.on('error', () => { observerFailed = true; child.kill(); browserChild?.kill(); });
  observer.on('exit', code => { if (code !== null && code !== 0) { observerFailed = true; child.kill(); browserChild?.kill(); } });
  // Watchdog externo: no depende de que el script respete los stages.
  const timer = setTimeout(() => { child.kill(); browserChild?.kill(); }, (seconds + 30) * 1000);
  const memoryWatch = setInterval(() => { if (os.freemem() < 2 * 1024 ** 3 || browserFailed) { observerFailed = true; child.kill(); browserChild?.kill(); } }, 2000);
  let runError = false;
  child.on('error', () => { runError = true; });
  // No imprimir cuerpos ni cabeceras; guardar únicamente el estado de salida.
  child.stdout.resume(); child.stderr.resume(); observer.stderr.resume();
  const code = await new Promise<number | null>(resolve => { child.once('exit', resolve); child.once('error', () => resolve(null)); });
  if (code !== 0) browserChild?.kill();
  const browserCode = await browserClosed;
  clearTimeout(timer);
  clearInterval(memoryWatch);
  if (proxy) {
    const results = browserEvidence.split(/\r?\n/).flatMap(line => {
      try {
        const log = JSON.parse(line), result = JSON.parse(log.msg);
        return result.event === 'browser_observer' ? [{ event: 'browser_observer', productId: result.productId,
          unitPriceClp: result.unitPriceClp, quantity: result.quantity, events: result.events, evidence: result.evidence }] : [];
      } catch { return []; }
    });
    if (results.length !== 1) browserFailed = true;
    writeFileSync(path.join(output, 'browser/outcome.json'), JSON.stringify({ exitCode: browserCode, failed: browserFailed, proxy: proxy.stats(), results }, null, 2), { flag: 'wx' });
    await proxy.close(); closeProxy = undefined;
  }
  observer.kill();
  await observerClosed;
  const endedAt = Date.now();
  stage = 'collect-and-export';
  const logs = call(docker, [...compose, 'logs', '--no-color', '--no-log-prefix', '--since', new Date(createdAt).toISOString(), 'app']);
  const metrics = logs.split(/\r?\n/).filter(line => { try { return typeof JSON.parse(line).event === 'string'; } catch { return false; } }).join('\n') + '\n' + observations;
  const input = path.join(output, 'application.jsonl');
  writeFileSync(input, metrics, { flag: 'wx' });
  writeFileSync(path.join(output, 'outcome.json'), JSON.stringify({ exitCode: code, runError, observerFailed, browserFailed, endedAt: new Date(endedAt).toISOString(), elapsedSeconds: (endedAt - createdAt) / 1000 }, null, 2), { flag: 'wx' });
  await exportMetrics(input, path.join(output, 'application'), (endedAt - createdAt) / 1000);
  console.log(JSON.stringify({ environmentId: runId, experimentId, profile, exitCode: code, observerFailed, output }));
  if (code !== 0 || runError || observerFailed || browserFailed) process.exitCode = 1;
}
main().catch(() => { console.error(JSON.stringify({ operation: 'performance', stage, code: 'PERFORMANCE_STOPPED', message: 'Revisar Docker, recursos, plan y destino local; no se reintenta automáticamente.' })); process.exitCode = 1; }).finally(async () => {
  for (const child of children) if (child.exitCode === null && child.signalCode === null) child.kill();
  await closeProxy?.();
  try { restoreAnalytics?.(); } catch { console.error('No se confirmó Analytics apagado en el laboratorio; detener y revisar antes de reutilizarlo.'); process.exitCode = 1; }
  if (ownsLock) unlinkSync(lockFile);
});
