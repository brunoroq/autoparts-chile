// Política independiente: no amplía los permisos del laboratorio histórico 3100.
export const PURCHASE_URL = 'http://127.0.0.1:3102';
export const purchaseLimits = Object.freeze({ vus: 10, purchases: 10, requests: 500, seconds: 120 });
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export function validatePurchasePlan(p, now = Date.now()) {
  const fields = ['workload', 'baseUrl', 'runId', 'environmentId', 'paymentProvider', 'analytics', 'vus', 'maxPurchases', 'maxRequests', 'seconds', 'createdAt', 'deadline'];
  if (!p || Object.keys(p).length !== fields.length || Object.keys(p).some(k => !fields.includes(k)) || p.baseUrl !== PURCHASE_URL || p.workload !== 'purchase' || !uuid.test(p.runId) ||
      !uuid.test(p.environmentId) || p.paymentProvider !== 'SIMULATED' || p.analytics !== false ||
      !Number.isInteger(p.vus) || p.vus < 1 || p.vus > purchaseLimits.vus ||
      !Number.isInteger(p.maxPurchases) || p.maxPurchases < p.vus || p.maxPurchases > purchaseLimits.purchases ||
      !Number.isInteger(p.maxRequests) || p.maxRequests < p.maxPurchases * 20 + p.vus * 4 + 1 || p.maxRequests > purchaseLimits.requests ||
      !Number.isInteger(p.seconds) || p.seconds < 10 || p.seconds > purchaseLimits.seconds ||
      !Number.isFinite(p.createdAt) || !Number.isFinite(p.deadline) || p.createdAt > now || now >= p.deadline ||
      p.deadline !== p.createdAt + p.seconds * 1000) throw new Error('PURCHASE_PLAN_REJECTED');
  return p;
}
export function validatePurchaseMarker(m, p) {
  if (!m || m.isolated !== true || m.workload !== 'purchase' || m.runId !== p.environmentId ||
      m.origin !== PURCHASE_URL || m.database !== 'autoparts_purchase_test' || m.paymentProvider !== 'SIMULATED' ||
      m.analytics !== false || m.measurementId !== '' || m.syntheticMeasurementId !== '') throw new Error('PURCHASE_ISOLATION_REJECTED');
}
export function allowedPurchaseRequest(method, route) {
  if (typeof route !== 'string' || /[\\?#\r\n%]/.test(route) || !route.startsWith('/') || route.startsWith('//')) return false;
  if (method === 'GET') return ['/api/performance/status', '/api/auth/csrf', '/api/auth/session', '/api/v1/cart', '/api/v1/products'].includes(route) ||
    new RegExp('^/api/v1/(products|orders)/' + uuid.source.slice(1, -1) + '$').test(route);
  return method === 'POST' && (['/api/auth/callback/credentials', '/api/v1/cart/items', '/api/v1/checkout'].includes(route) ||
    new RegExp('^/api/v1/payments/' + uuid.source.slice(1, -1) + '/simulate$').test(route));
}
export function purchaseBudget(plan, vu) {
  if (!Number.isInteger(vu) || vu < 1 || vu > plan.vus) throw new Error('PURCHASE_VU_REJECTED');
  const purchases = Math.floor(plan.maxPurchases / plan.vus) + (vu <= plan.maxPurchases % plan.vus ? 1 : 0);
  // Reservar una solicitud para el preflight HTTP del runner.
  return purchases * 20 + Math.floor((plan.maxRequests - 1 - plan.vus * 4 - plan.maxPurchases * 20) / plan.vus);
}
