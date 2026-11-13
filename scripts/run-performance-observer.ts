import { spawn, type ChildProcess } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createServer } from 'node:net';
import { BROWSER_BASE_URL, BROWSER_LIMITS, validateBrowserPlan } from '../performance/k6/browser-policy.js';
import { browserProxy } from './performance-browser-proxy';
import { observerSpecification, observerCreateArgs, protectedSnapshot, stopOwnedObserver, type Container, type DockerCall } from './performance-observer-container';
import { dockerCounters } from '../src/lib/observability/docker';
import { sanitizeObserverLog } from './performance-observer-evidence';
import { BrowserDiagnostics, socketErrorCode } from '../performance/k6/browser-diagnostics.js';
import { diagnosticStream } from './performance-observer-diagnostics';

type Input = {root: string; environmentId: string; measurementId: string; k6: string; env: NodeJS.ProcessEnv; source: {commit:string; dirty:boolean}};
const pause = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
const assertMemory = () => { if (os.freemem() < 2 * 1024 ** 3) throw new Error('OBSERVER_HOST_MEMORY_LOW'); };
async function freePort() {
  const server = createServer();
  await new Promise<void>((resolve, reject) => { server.once('error', reject); server.listen(3101, '127.0.0.1', resolve); });
  await new Promise<void>(resolve => server.close(() => resolve()));
}
function businessFingerprint(call: DockerCall, pg: string) {
  // Solo SELECT, socket local y transacción forzada a lectura. No exponer filas.
  const tables = ['Product', 'Category', 'User', 'Cart', 'CartItem', 'Order', 'OrderItem', 'PaymentAttempt', 'CartMergeReceipt'];
  const parts = tables.map(name => `'${name}',(SELECT json_build_object('count',count(*),'hash',md5(COALESCE(string_agg(row_to_json(t)::text,E'\\n' ORDER BY t.id),''))) FROM "${name}" t)`);
  return JSON.parse(call(['exec', '-e', 'PGOPTIONS=-c default_transaction_read_only=on', pg, 'psql', '-U', 'performance', '-d', 'autoparts_performance_test', '-X', '-A', '-t', '-v', 'ON_ERROR_STOP=1', '-c', `SELECT json_build_object(${parts.join(',')});`]));
}

/** Solo el modo --execute del runner lo invoca; no altera Compose ni el original. */
export async function runPerformanceObserver(input: Input, call: DockerCall) {
  const experimentId = randomUUID();
  const directory = path.join(input.root, 'artifacts/performance', input.environmentId, `browser-observer-${experimentId}`);
  let owned = '', snapshot = '', protectedIds: string[] = [], originalFingerprint: unknown;
  let child: ChildProcess | undefined, proxy: Awaited<ReturnType<typeof browserProxy>> | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined, watch: ReturnType<typeof setInterval> | undefined;
  let stage = 'preflight', failed = false, success = false, errorCode: string | null = null;
  const samples: unknown[] = [];
  const inspect = (ids: string[]) => JSON.parse(call(['inspect', ...ids])) as Container[];
  let evidence = '';
  mkdirSync(directory, {recursive: false});
  const save = (name: string, value: unknown) => writeFileSync(path.join(directory, name), JSON.stringify(value, null, 2), {flag: 'wx', mode: 0o600});
  const diagnosticFile = path.join(directory, 'diagnostics.jsonl');
  writeFileSync(diagnosticFile, '', {flag:'wx', mode:0o600});
  const diagnostics = new BrowserDiagnostics({measurementId:input.measurementId,
    sink:row => appendFileSync(diagnosticFile, JSON.stringify(row) + '\n')});
  const stream = diagnosticStream(diagnostics);
  const stdoutStream = diagnosticStream(diagnostics);
  diagnostics.record('RUNNER_PHASE', {source:'runner', phase:'preflight'});
  try {
    assertMemory(); await freePort();
    const allIds = call(['ps', '-aq']).trim().split(/\s+/).filter(Boolean);
    const all = inspect(allIds);
    const app = all.find(c => c.Name === '/autoparts-performance-app-1');
    const pg = all.find(c => c.Name === '/autoparts-performance-postgres-1');
    if (!app || !pg) throw new Error('ORIGINAL_LAB_NOT_FOUND');
    const spec = observerSpecification(app, pg, input.environmentId, experimentId, input.measurementId);
    protectedIds = all.map(c => c.Id); snapshot = protectedSnapshot(all);
    const network = JSON.parse(call(['network', 'inspect', spec.privateNetwork]))[0];
    const ingress = JSON.parse(call(['network', 'inspect', spec.ingress]))[0];
    if (!network.Internal || ingress.Options?.['com.docker.network.bridge.host_binding_ipv4'] !== '127.0.0.1') throw new Error('NETWORK_ISOLATION_INVALID');
    originalFingerprint = businessFingerprint(call, pg.Id);
    const fp = originalFingerprint as Record<string, {count: number}>;
    if (fp.Product.count !== 30 || fp.Category.count !== 6 || ['User', 'Cart', 'Order', 'PaymentAttempt'].some(t => fp[t].count !== 0)) throw new Error('LAB_DATA_UNEXPECTED');
    save('data-before.json', originalFingerprint);
    save('manifest.json', {experimentId, environmentId: input.environmentId, baseUrl: BROWSER_BASE_URL,
      measurementId: input.measurementId, observers: 1, iterations: 1, httpWorkload: false,
      source:input.source, protectedContainers: all.map(c => ({id: c.Id, name: c.Name, image: c.Image})), limits: BROWSER_LIMITS});
    stage = 'build-observer-image';
    diagnostics.record('RUNNER_PHASE', {source:'runner', phase:'preparation'});
    const tag = `autoparts-performance-observer:${experimentId}`;
    call(['build', '--file', 'Dockerfile.performance', '--tag', tag, '.'], 900000);
    assertMemory();
    const image = JSON.parse(call(['image', 'inspect', tag]))[0].Id as string;
    const envFile = path.join(directory, 'observer.env');
    writeFileSync(envFile, Object.entries(spec.env).map(([k,v]) => `${k}=${v}`).join('\n'), {flag: 'wx', mode: 0o600});
    stage = 'create-additional-container';
    const id = call(observerCreateArgs(spec, experimentId, envFile, image)).trim();
    if (!/^[a-f0-9]{64}$/.test(id) || protectedIds.includes(id)) throw new Error('CREATED_ID_INVALID');
    owned = id;
    call(['start', owned]);
    save('container.json', {id: owned, name: spec.name, image, baseUrl: BROWSER_BASE_URL});
    stage = 'verify-additional-container';
    let healthy = false;
    for (let n = 0; n < 30; n++) {
      const c = inspect([owned])[0];
      if (!c.State.Running || c.State.OOMKilled || c.State.Health?.Status === 'unhealthy') throw new Error('OBSERVER_UNHEALTHY');
      if (c.State.Health?.Status === 'healthy') { healthy = true; break; }
      await pause(1000);
    }
    const c = inspect([owned])[0];
    if (!healthy || c.Mounts.length || Object.keys(c.HostConfig.PortBindings).length !== 1 ||
        JSON.stringify(c.NetworkSettings.Ports?.['3000/tcp']) !== JSON.stringify([{HostIp:'127.0.0.1', HostPort:'3101'}]) ||
        JSON.stringify(Object.keys(c.NetworkSettings.Networks).sort()) !== JSON.stringify([spec.privateNetwork,spec.ingress].sort()) ||
        c.HostConfig.Memory !== 1024 ** 3 || c.HostConfig.NanoCpus !== 1000000000) throw new Error('OBSERVER_RUNTIME_ISOLATION_INVALID');
    if (protectedSnapshot(inspect(protectedIds)) !== snapshot) throw new Error('ORIGINAL_CONTAINER_CHANGED');
    const response = await fetch(BROWSER_BASE_URL + '/api/performance/status', {redirect: 'error', signal: AbortSignal.timeout(5000)});
    const marker = await response.json();
    if (!response.ok || marker.isolated !== true || marker.observer !== true || marker.origin !== BROWSER_BASE_URL ||
        marker.runId !== experimentId || marker.catalogSize !== 30 || marker.analytics !== true || marker.measurementId !== input.measurementId) throw new Error('OBSERVER_MARKER_INVALID');
    save('isolation.json', marker);
    assertMemory();
    const createdAt = Date.now(), deadline = createdAt + 120000;
    proxy = await browserProxy(deadline, () => { failed = true; child?.kill(); }, {diagnostics});
    const plan = validateBrowserPlan({baseUrl: BROWSER_BASE_URL, measurementId: input.measurementId, proxyPort: proxy.port,
      runId: experimentId, catalogSize: 30, delaySeconds: 0, createdAt, deadline});
    const planFile = path.join(directory, 'plan.json'); save('plan.json', plan);
    const args = `proxy-server=http://127.0.0.1:${proxy.port},proxy-bypass-list=<-loopback>`;
    stage = 'single-browser-journey';
    diagnostics.record('K6_SPAWN_REQUESTED', {source:'runner', phase:'browser_launch'});
    child = spawn(input.k6, ['run', '-e', `K6_BROWSER_ARGS=${args}`, '-e', `PERF_BROWSER_PLAN=${planFile}`, 'performance/k6/browser-journey.js'],
      {cwd: input.root, env: {...input.env, K6_BROWSER_ARGS: args, K6_BROWSER_HEADLESS: 'true', K6_LOG_FORMAT: 'json', K6_NO_USAGE_REPORT: 'true'}, stdio: ['ignore','pipe','pipe']});
    child.stdout?.on('data', chunk => stdoutStream.consume(chunk));
    child.stderr?.on('data', chunk => { stream.consume(chunk); evidence = (evidence + String(chunk)).slice(-512000); });
    timer = setTimeout(() => { diagnostics.record('WATCHDOG_STOP', {source:'runner', reason:'DEADLINE_EXCEEDED', fatal:true}); failed = true; child?.kill(); }, 120000);
    let sampling = false, saturation = 0;
    const sample = () => {
      if (sampling) return; sampling = true;
      try {
        assertMemory();
        if (protectedSnapshot(inspect(protectedIds)) !== snapshot) throw new Error('PROTECTED_STATE_CHANGED');
        const current = inspect([owned])[0];
        if (!current.State.Running || current.State.OOMKilled || current.State.Health?.Status !== 'healthy' || current.RestartCount) throw new Error('OBSERVER_HEALTH_CHANGED');
        const resources = [owned, pg.Id].map(id => ({id, ...dockerCounters(JSON.parse(call(['stats', '--no-stream', '--format', '{{json .}}', id], 5000)))}));
        const r = resources[0];
        if (resources.some(r => !Number.isFinite(r.cpuPercent) || !Number.isFinite(r.memoryPercent) || r.memoryBytes === null)) throw new Error('RESOURCE_SAMPLE_INVALID');
        saturation = r.cpuPercent >= 95 || r.memoryPercent >= 90 ? saturation + 1 : 0;
        samples.push({at: new Date().toISOString(), hostFreeBytes: os.freemem(), resources});
        if (saturation >= 6) throw new Error('SUSTAINED_SATURATION');
        } catch { diagnostics.record('RESOURCE_STOP', {source:'runner', reason:'RESOURCE_OR_HEALTH_CHECK', fatal:true}); failed = true; child?.kill(); } finally { sampling = false; }
    };
    watch = setInterval(sample, 5000);
    const exitCode = await new Promise<number | null>(resolve => {
      child!.once('close', (code, signal) => { stream.flush(); stdoutStream.flush(); diagnostics.record('K6_PROCESS_CLOSED', {source:'runner', exitCode:code, signal:signal || undefined}); resolve(code); });
      child!.once('error', error => { diagnostics.record('K6_SPAWN_ERROR', {source:'runner', errno:socketErrorCode(error), fatal:true}); failed = true; resolve(null); });
    });
    clearInterval(watch); watch = undefined; clearTimeout(timer); timer = undefined;
    sample();
    const result = sanitizeObserverLog(evidence, input.measurementId, experimentId);
    save('browser-outcome.json', {exitCode, failed, proxy: proxy.stats(), result});
    if (exitCode !== 0 || failed || !result?.verified) throw new Error('OBSERVER_RESULT_FAILED');
    stage = 'verify-business-data';
    const final = businessFingerprint(call, pg.Id); save('data-after.json', final);
    if (JSON.stringify(final) !== JSON.stringify(originalFingerprint)) throw new Error('BUSINESS_DATA_CHANGED');
    success = true;
  } catch (error) {
    failed = true;
    errorCode = error instanceof Error && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.message) ? error.message : 'OBSERVER_OPERATION_FAILED';
    throw new Error(errorCode);
  } finally {
      stream.flush(); stdoutStream.flush();
      diagnostics.record('RUNNER_PHASE', {source:'runner', phase:'cleanup'});
    if (watch) clearInterval(watch); if (timer) clearTimeout(timer);
    if (child && child.exitCode === null && child.signalCode === null) child.kill();
    let cleanupFailed = false, observerStopped = false, originalsUnchanged = false;
    try { await proxy?.close(); } catch { cleanupFailed = true; }
    try { if (owned) { stopOwnedObserver(call, owned, experimentId, protectedIds); observerStopped = true; } } catch { cleanupFailed = true; }
    try { originalsUnchanged = !snapshot || protectedSnapshot(inspect(protectedIds)) === snapshot; } catch { cleanupFailed = true; }
    save('diagnostics.json', diagnostics.snapshot());
    save('resources.json', samples);
    success = success && !cleanupFailed && originalsUnchanged;
    save('outcome.json', {success, stage, failed, errorCode, cleanupFailed, originalsUnchanged, originalContainersStopped: false,
      observerContainerId: owned || null, observerStopped, experimentId,
      finishedAt: new Date().toISOString(), googleInterfaceConfirmed: false});
    if (!originalsUnchanged) throw new Error('ORIGINAL_STATE_CHANGED_NO_REPAIR_ATTEMPTED');
    if (cleanupFailed) throw new Error('OBSERVER_CLEANUP_NOT_CONFIRMED');
    console.log(JSON.stringify({operation:'browser-observer', success, experimentId, output:directory, originalsUnchanged}));
  }
}
