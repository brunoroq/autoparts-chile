import { validSyntheticId } from '../analytics/synthetic';
// No basta una etiqueta: la instancia debe usar la base exclusiva del Compose.
export function performanceIsolation(env: Record<string, string | undefined>) {
  if (env.PERF_ISOLATED !== 'true') return null;
  const url = new URL(env.DATABASE_URL || '');
  const analytics = env.ANALYTICS_ENABLED === 'true' &&
    env.PERF_BROWSER_ANALYTICS === 'true' &&
    validSyntheticId(env.GA4_SYNTHETIC_MEASUREMENT_ID, env.GA4_MEASUREMENT_ID);
  if (env.VERCEL || url.protocol !== 'postgresql:' || url.hostname !== 'postgres' || url.port !== '5432' || url.search || url.hash ||
      (env.DIRECT_URL !== undefined && env.DIRECT_URL !== env.DATABASE_URL) ||
      url.pathname !== '/autoparts_performance_test' ||
      (env.ANALYTICS_ENABLED !== 'false' && !analytics) ||
      env.NEXTAUTH_URL !== 'http://127.0.0.1:3100' ||
      env.TRAFFIC_KIND !== 'synthetic' || env.PAYMENT_PROVIDER !== 'simulated' ||
      !/^[a-f0-9-]{36}$/.test(env.EXPERIMENT_ID || '') ||
      !['30', '1000', '10000'].includes(env.CATALOG_SIZE || '')) {
    throw new Error('Configuración aislada inválida.');
  }
  return { isolated: true, runId: env.EXPERIMENT_ID, catalogSize: Number(env.CATALOG_SIZE),
    analytics: !!analytics, measurementId: analytics ? env.GA4_SYNTHETIC_MEASUREMENT_ID : '' };
}
