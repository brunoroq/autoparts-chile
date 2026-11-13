import { BROWSER_BASE_URL } from '../performance/k6/browser-policy.js';
import { validSyntheticId } from '../src/lib/analytics/synthetic';

export type Container = {
  Id: string; Name: string; Image: string; RestartCount: number;
  State: {Running: boolean; Status: string; StartedAt: string; OOMKilled?: boolean; Health?: {Status: string}};
  Config: {Env: string[]; Labels: Record<string, string>; Cmd?: string[]};
  HostConfig: {PortBindings: Record<string, {HostIp: string; HostPort: string}[]>; Memory?: number; NanoCpus?: number};
  NetworkSettings: {Networks: Record<string, unknown>; Ports?: Record<string, {HostIp: string; HostPort: string}[] | null>};
  Mounts: {Type: string; Name?: string; Destination: string}[];
};
export type DockerCall = (args: string[], timeout?: number) => string;
export const observerLabels = { owner: 'autoparts.performance.observer', experiment: 'autoparts.performance.experiment' };
export function containerEnv(c: Container) {
  return Object.fromEntries(c.Config.Env.map(row => { const i = row.indexOf('='); return [row.slice(0, i), row.slice(i + 1)]; }));
}
export function protectedSnapshot(containers: Container[]) {
  // La configuración completa se compara solo en memoria; no exportar secretos.
  return JSON.stringify(containers.map(c => ({id: c.Id, image: c.Image, name: c.Name,
    status: c.State.Status, health: c.State.Health?.Status, oomKilled:c.State.OOMKilled, startedAt: c.State.StartedAt, restartCount: c.RestartCount,
    env: c.Config.Env, labels: c.Config.Labels, ports: c.HostConfig.PortBindings,
    networks: c.NetworkSettings.Networks, mounts: c.Mounts})));
}
export function observerSpecification(app: Container, pg: Container, environmentId: string, experimentId: string, measurementId: string) {
  const env = containerEnv(app), db = new URL(env.DATABASE_URL || '');
  const pgEnv = containerEnv(pg);
  if (!/^[a-f0-9-]{36}$/.test(environmentId) || !/^[a-f0-9-]{36}$/.test(experimentId) || !validSyntheticId(measurementId, env.GA4_MEASUREMENT_ID) ||
      app.Name !== '/autoparts-performance-app-1' || pg.Name !== '/autoparts-performance-postgres-1' ||
      app.Config.Labels['com.docker.compose.project'] !== 'autoparts-performance' ||
      pg.Config.Labels['com.docker.compose.project'] !== 'autoparts-performance' || app.Id === pg.Id ||
      app.State.Health?.Status !== 'healthy' || pg.State.Health?.Status !== 'healthy' || !app.State.Running || !pg.State.Running ||
      env.PERF_ISOLATED !== 'true' || env.ANALYTICS_ENABLED !== 'false' || env.GA4_MEASUREMENT_ID || env.GA4_SYNTHETIC_MEASUREMENT_ID ||
      env.TRAFFIC_KIND !== 'synthetic' || env.APP_ENV !== 'performance-local' || env.PAYMENT_PROVIDER !== 'simulated' || env.CATALOG_SIZE !== '30' ||
      env.NEXTAUTH_URL !== 'http://127.0.0.1:3100' || db.protocol !== 'postgresql:' || db.hostname !== 'postgres' || db.port !== '5432' ||
      db.pathname !== '/autoparts_performance_test' || db.search || db.hash || env.DIRECT_URL !== env.DATABASE_URL ||
      pgEnv.POSTGRES_DB !== 'autoparts_performance_test' || pgEnv.POSTGRES_USER !== 'performance' ||
      !env.NEXTAUTH_SECRET || !env.PAYMENT_TOKEN_SECRET ||
      JSON.stringify(app.HostConfig.PortBindings) !== JSON.stringify({'3000/tcp': [{HostIp: '127.0.0.1', HostPort: '3100'}]}) ||
      JSON.stringify(app.NetworkSettings.Ports?.['3000/tcp']) !== JSON.stringify([{HostIp:'127.0.0.1',HostPort:'3100'}]) ||
      Object.keys(pg.HostConfig.PortBindings || {}).length || Object.values(pg.NetworkSettings.Ports || {}).some(p => p?.length) || pg.Mounts.length !== 1 ||
      pg.Mounts[0].Name !== `autoparts-performance-${environmentId}`) throw new Error('OBSERVER_SOURCE_ISOLATION_INVALID');
  const privateNetwork = Object.keys(pg.NetworkSettings.Networks);
  const ingress = Object.keys(app.NetworkSettings.Networks).filter(n => !privateNetwork.includes(n));
  if (privateNetwork.length !== 1 || ingress.length !== 1 || !Object.hasOwn(app.NetworkSettings.Networks, privateNetwork[0])) throw new Error('OBSERVER_NETWORK_INVALID');
  const observerEnv = {
    DATABASE_URL: env.DATABASE_URL, DIRECT_URL: env.DIRECT_URL, NEXTAUTH_SECRET: env.NEXTAUTH_SECRET,
    PAYMENT_TOKEN_SECRET: env.PAYMENT_TOKEN_SECRET, PAYMENT_PROVIDER: 'simulated', WEBPAY_ENVIRONMENT: 'integration',
    PERF_ISOLATED: 'true', PERF_OBSERVER_CONTAINER: 'true', PERF_BROWSER_ANALYTICS: 'true',
    ANALYTICS_ENABLED: 'true', GA4_MEASUREMENT_ID: '', GA4_SYNTHETIC_MEASUREMENT_ID: measurementId,
    GA4_DEBUG: 'false', WEB_VITALS_ENABLED: 'false', RESOURCE_METRICS_ENABLED: 'false',
    APP_ENV: 'performance-local', TRAFFIC_KIND: 'synthetic', EXPERIMENT_ID: experimentId,
    CATALOG_SIZE: '30', EXPERIMENT_CONCURRENCY: '1', NEXTAUTH_URL: BROWSER_BASE_URL,
    DB_POOL_MAX: '2', NEXT_TELEMETRY_DISABLED: '1',
  };
  return { name: `autoparts-performance-observer-${experimentId}`, privateNetwork: privateNetwork[0], ingress: ingress[0], env: observerEnv };
}

// El contenedor se apaga por sí solo aun si el runner desaparece. No reinicia.
const lifetime = "const {spawn}=require('node:child_process');const p=spawn(process.execPath,['node_modules/next/dist/bin/next','start','--hostname','0.0.0.0','--port','3000'],{stdio:'inherit'});const t=setTimeout(()=>{p.kill('SIGTERM');setTimeout(()=>process.exit(124),5000)},180000);p.on('exit',c=>{clearTimeout(t);process.exit(c??1)});process.on('SIGTERM',()=>p.kill('SIGTERM'));";
export function observerCreateArgs(spec: ReturnType<typeof observerSpecification>, experimentId: string, envFile: string, image: string) {
  if (!/^sha256:[a-f0-9]{64}$/.test(image)) throw new Error('OBSERVER_IMAGE_INVALID');
  return ['create', '--name', spec.name, '--label', `${observerLabels.owner}=true`, '--label', `${observerLabels.experiment}=${experimentId}`,
    '--network', spec.privateNetwork, '--network', spec.ingress, '--dns', '127.0.0.1', '--publish', '127.0.0.1:3101:3000',
    '--cpus', '1', '--memory', '1g', '--memory-swap', '1g', '--pids-limit', '128', '--restart', 'no',
    '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges', '--stop-timeout', '5', '--env-file', envFile,
    '--health-cmd', "node -e \"fetch('http://127.0.0.1:3000/api/performance/status').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))\"",
    '--health-interval', '5s', '--health-timeout', '3s', '--health-retries', '6',
    '--entrypoint', 'node', image, '-e', lifetime];
}
/** Única mutación de limpieza permitida: stop sobre el contenedor propio. */
export function stopOwnedObserver(call: DockerCall, id: string, experimentId: string, protectedIds: string[]) {
  if (!/^[a-f0-9]{64}$/.test(id) || protectedIds.includes(id)) throw new Error('OBSERVER_STOP_FORBIDDEN');
  const c: Container = JSON.parse(call(['inspect', id]))[0];
  if (c.Id !== id || c.Name !== `/autoparts-performance-observer-${experimentId}` ||
      c.Config.Labels[observerLabels.owner] !== 'true' || c.Config.Labels[observerLabels.experiment] !== experimentId) throw new Error('OBSERVER_OWNERSHIP_INVALID');
  if (c.State.Running) call(['stop', '--time', '5', id], 15000);
  const stopped: Container = JSON.parse(call(['inspect', id]))[0];
  if (stopped.State.Running) throw new Error('OBSERVER_STOP_NOT_CONFIRMED');
}
