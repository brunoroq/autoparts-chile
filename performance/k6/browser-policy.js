export const BROWSER_LIMITS = Object.freeze({ requests: 400, tunnels: 24, bytes: 32 * 1024 * 1024 });
const googleHosts = ['www.googletagmanager.com', 'www.google-analytics.com', 'region1.google-analytics.com'];
export function googleHost(host) { return googleHosts.includes(host); }
// k6 no ofrece todas las APIs DOM de Node/Chrome. Analizar solo URLs canónicas
// absolutas; no resolver nombres, credenciales, fragmentos o URLs relativas.
function parsed(raw) {
  const m = /^(https?):\/\/([a-z0-9.-]+)(:\d+)?(\/[^#]*)?$/.exec(raw || '');
  if (!m) return null;
  const route = m[4] || '/', q = route.indexOf('?');
  return { origin: `${m[1]}://${m[2]}${m[3] || ''}`, host: m[2],
    path: q < 0 ? route : route.slice(0, q), query: q < 0 ? '' : route.slice(q + 1) };
}
/** Lista de lectura/cotización; también restringe prefetch automático de Next. */
export function browserRequestAllowed(method, rawUrl) {
  const url = parsed(rawUrl);
  if (!url || url.origin !== 'http://127.0.0.1:3100') return false;
  const p = url.path;
  if (method === 'POST') return p === '/api/v1/cart/guest' && !url.query;
  if (method !== 'GET') return false;
  return ['/', '/catalogo', '/carrito', '/api/performance/status', '/api/v1/products', '/api/v1/categories', '/api/v1/cart'].includes(p) ||
    /^\/productos\/[a-z0-9-]+$/.test(p) || /^\/api\/v1\/products\/[a-f0-9-]{36}$/.test(p) ||
    /^\/_next\/(static\/|image\?)/.test(p + (url.query ? '?' + url.query : '')) ||
    /^\/(images|products)\/[a-zA-Z0-9_./-]+$/.test(p) || p === '/favicon.ico';
}
/** Antes del transporte TLS: rechazar otros IDs, incluso en envíos agrupados. */
export function browserNetworkAllowed(method, rawUrl, body, measurementId) {
  if (!/^G-[A-Z0-9]{5,20}$/.test(measurementId || '') || measurementId === 'G-VVKYV486NP') return false;
  const url = parsed(rawUrl);
  if (!url) return false;
  if (url.origin === 'http://127.0.0.1:3100') return browserRequestAllowed(method, rawUrl);
  if (url.origin !== `https://${url.host}` || !googleHost(url.host)) return false;
  const script = url.host === 'www.googletagmanager.com';
  if (script ? method !== 'GET' || !['/gtag/js', '/gtag/destination'].includes(url.path)
    : !['GET', 'POST'].includes(method) || url.path !== '/g/collect') return false;
  try {
    const parts = (url.query + '\n' + (body || '')).split(/[&\n]/).map(p => {
      const i = p.indexOf('=');
      return [decodeURIComponent(i < 0 ? p : p.slice(0, i)), decodeURIComponent(i < 0 ? '' : p.slice(i + 1))];
    });
    const ids = parts.filter(([key]) => ['id', 'tid', 'send_to'].includes(key));
    return ids.length > 0 && ids.every(([, value]) => value === measurementId);
  } catch { return false; }
}
export function validateBrowserPlan(plan, now = Date.now()) {
  if (!plan || plan.baseUrl !== 'http://127.0.0.1:3100' ||
      !/^G-[A-Z0-9]{5,20}$/.test(plan.measurementId || '') || plan.measurementId === 'G-VVKYV486NP' ||
      !Number.isInteger(plan.proxyPort) || plan.proxyPort < 1 || plan.proxyPort > 65535 ||
      !/^[a-f0-9-]{36}$/.test(plan.runId || '') ||
      ![30, 1000, 10000].includes(plan.catalogSize) ||
      !Number.isInteger(plan.delaySeconds) || plan.delaySeconds < 0 || plan.delaySeconds > 90 ||
      !Number.isFinite(plan.createdAt) || plan.createdAt > now ||
      !Number.isFinite(plan.deadline) || now >= plan.deadline ||
      plan.deadline - plan.createdAt > 600000 || plan.deadline - plan.createdAt < (plan.delaySeconds + 90) * 1000) {
    throw new Error('Plan de navegador inválido: usar el runner protegido.');
  }
  return plan;
}
