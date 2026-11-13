export const BROWSER_LIMITS = Object.freeze({ requests: 400, tunnels: 24, bytes: 32 * 1024 * 1024 });
export const BROWSER_BASE_URL = 'http://127.0.0.1:3101';
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
  if (!url || url.origin !== BROWSER_BASE_URL) return false;
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
  return browserNetworkDecision(method, rawUrl, body, measurementId).allowed;
}
/** Motivos cerrados: nunca devolver la URL ni parámetros del navegador. */
export function browserNetworkDecision(method, rawUrl, body, measurementId) {
  const deny = reason => ({allowed:false, reason});
  if (measurementId === 'G-VVKYV486NP') return deny('OFFICIAL_ID_BLOCKED');
  if (!/^G-[A-Z0-9]{5,20}$/.test(measurementId || '')) return deny('MEASUREMENT_ID_INVALID');
  const url = parsed(rawUrl);
  if (!url) return deny('MALFORMED_URL');
  if (url.origin === BROWSER_BASE_URL) return browserRequestAllowed(method, rawUrl) ? {allowed:true, reason:'NONE'} : deny('LOCAL_ROUTE_BLOCKED');
  if (!googleHost(url.host)) return deny('REMOTE_HOST_BLOCKED');
  if (url.origin !== `https://${url.host}`) return deny('HTTPS_REQUIRED');
  const script = url.host === 'www.googletagmanager.com';
  if (script ? method !== 'GET' || !['/gtag/js', '/gtag/destination'].includes(url.path)
    : !['GET', 'POST'].includes(method) || url.path !== '/g/collect') return deny('GOOGLE_PATH_BLOCKED');
  try {
    const parts = (url.query + '\n' + (body || '')).split(/[&\n]/).map(p => {
      const i = p.indexOf('=');
      return [decodeURIComponent(i < 0 ? p : p.slice(0, i)), decodeURIComponent(i < 0 ? '' : p.slice(i + 1))];
    });
    const ids = parts.filter(([key]) => ['id', 'tid', 'send_to'].includes(key));
    if (!ids.length) return deny('MEASUREMENT_ID_MISSING');
    if (ids.some(([, value]) => value === 'G-VVKYV486NP')) return deny('OFFICIAL_ID_BLOCKED');
    return ids.every(([, value]) => value === measurementId) ? {allowed:true, reason:'NONE'} : deny('OTHER_ID_BLOCKED');
  } catch { return deny('MALFORMED_PARAMETERS'); }
}
/** Clasificación sin guardar hosts, rutas libres, consultas ni identificadores. */
export function diagnosticTarget(rawUrl) {
  const u = parsed(rawUrl);
  if (!u) return 'invalid';
  if (u.origin === BROWSER_BASE_URL) {
    if (u.path === '/') return 'local_home';
    if (u.path === '/catalogo') return 'local_catalog';
    if (u.path === '/carrito') return 'local_cart';
    if (u.path === '/api/performance/status') return 'local_isolation';
    if (u.path === '/api/v1/cart/guest') return 'local_quote';
    if (u.path === '/api/v1/cart') return 'local_cart_api';
    if (u.path.startsWith('/productos/')) return 'local_product';
    return browserRequestAllowed('GET', rawUrl) ? 'local_asset' : 'local_forbidden';
  }
  if (u.host === '127.0.0.1') return 'local_other_port';
  if (googleHost(u.host)) return u.host === 'www.googletagmanager.com' ? 'google_script' : u.path === '/g/collect' ? 'google_collect' : 'google_other_path';
  // Reconocer no significa autorizar: el tráfico auxiliar permanece bloqueado.
  if (u.host === 'clients2.google.com' && u.path.startsWith('/time/')) return 'chrome_auxiliary';
  return 'external';
}
export function validateBrowserPlan(plan, now = Date.now()) {
  if (!plan || plan.baseUrl !== BROWSER_BASE_URL ||
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
