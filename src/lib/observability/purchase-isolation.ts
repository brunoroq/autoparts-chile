// Solo la futura instancia de compras puede anunciar este marcador.
export function purchaseIsolation(env: Record<string, string | undefined>) {
  if (env.PERF_PURCHASE_ISOLATED !== 'true') return null;
  const db = new URL(env.DATABASE_URL || '');
  if (env.VERCEL || env.PERF_ISOLATED === 'true' || db.protocol !== 'postgresql:' || db.hostname !== 'purchase-postgres' || db.port !== '5432' ||
      db.pathname !== '/autoparts_purchase_test' || db.search || db.hash ||
      (env.DIRECT_URL !== undefined && env.DIRECT_URL !== env.DATABASE_URL) ||
      env.NEXTAUTH_URL !== 'http://127.0.0.1:3102' || env.PAYMENT_PROVIDER !== 'simulated' || env.WEBPAY_ENVIRONMENT !== 'integration' || env.TRAFFIC_KIND !== 'synthetic' ||
      env.ANALYTICS_ENABLED !== 'false' || env.GA4_MEASUREMENT_ID !== '' || env.GA4_SYNTHETIC_MEASUREMENT_ID !== '' ||
      env.PERF_BROWSER_ANALYTICS !== 'false' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(env.EXPERIMENT_ID || '')) {
    throw new Error('PURCHASE_ISOLATION_INVALID');
  }
  return { isolated: true, workload: 'purchase', runId: env.EXPERIMENT_ID, origin: env.NEXTAUTH_URL,
    database: 'autoparts_purchase_test', paymentProvider: 'SIMULATED', analytics: false,
    measurementId: '', syntheticMeasurementId: '' };
}
