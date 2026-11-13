import { browserNetworkAllowed } from './browser-policy.js';

const names = new Set(['page_view', 'view_item', 'add_to_cart', 'remove_from_cart',
  'first_visit', 'session_start', 'user_engagement', 'scroll']);
function parameters(text) {
  const result = Object.create(null);
  for (const part of text.split('&')) {
    if (!part) continue;
    const i = part.indexOf('=');
    const key = decodeURIComponent(i < 0 ? part : part.slice(0, i));
    const value = decodeURIComponent((i < 0 ? '' : part.slice(i + 1)).replace(/\+/g, ' '));
    if (Object.hasOwn(result, key) && result[key] !== value) throw new Error('AMBIGUOUS_PARAMETERS');
    result[key] = value;
  }
  return result;
}
/** Nunca devolver URL, cid, sid, cookies, títulos o parámetros libres. */
export function collectEvidence(method, url, body, measurementId, experimentId) {
  if (!browserNetworkAllowed(method, url, body, measurementId)) return null;
  const match = /^https:\/\/(?:www|region1)\.google-analytics\.com\/g\/collect(?:\?([^#]*))?$/.exec(url);
  if (!match) return [];
  try {
    const common = parameters(match[1] || '');
    const lines = (body || '').split(/\r?\n/).filter(Boolean);
    const payloads = lines.length ? lines : [''];
    if (payloads.length > 32) return null;
    return payloads.map(line => {
      const p = { ...common, ...parameters(line) };
      if (!names.has(p.en)) throw new Error('EVENT_NOT_ALLOWED');
      const labelsVerified = p['ep.environment'] === 'performance-local' &&
        p['ep.traffic_kind'] === 'synthetic' && p['ep.experiment_id'] === experimentId;
      return { event: p.en, measurementId, labelsVerified,
        experimentId: labelsVerified ? experimentId : null,
        environment: labelsVerified ? 'performance-local' : null,
        trafficKind: labelsVerified ? 'synthetic' : null,
        firstVisitFlag: p._fv === '1', sessionStartFlag: p._ss === '1' };
    });
  } catch { return null; }
}

/** Compartido por k6 y tests offline. Correlación efímera solo en memoria. */
export function attachAnalyticsEvidence(page, measurementId, experimentId, diagnose = () => {}) {
  const pending = new Map();
  const rows = [];
  const state = { rows, failed: false, pending: 0 };
  const key = req => `${req.method()} ${req.url()} ${req.postData() || ''}`;
  const safe = req => collectEvidence(req.method(), req.url(), req.postData(), measurementId, experimentId);
  const finish = (req, status, transport) => {
    const k = key(req), queue = pending.get(k);
    if (!queue?.length) return;
    const records = queue.shift(); state.pending--;
    if (!queue.length) pending.delete(k);
    for (const row of records) {
      diagnose(status === null ? 'ANALYTICS_REQUEST_FAILED' : 'ANALYTICS_HTTP_RESPONSE', {phase:'analytics_event', analyticsEvent:row.event, measurementId, httpStatus:status, fatal:status === null || status < 200 || status >= 300});
      if (rows.length >= 400) { state.failed = true; break; }
      rows.push({ ...row, httpStatus: status, transport,
        httpSuccess: status !== null && status >= 200 && status < 300,
        googleIngestionConfirmed: false });
    }
  };
  page.on('request', req => {
    try {
      const records = safe(req);
      if (records === null) return; // La ruta bloqueará antes de enviar.
      if (!records.length) return;
      for (const row of records) diagnose('ANALYTICS_REQUEST', {phase:'analytics_event', analyticsEvent:row.event, measurementId});
      const k = key(req), queue = pending.get(k) || [];
      queue.push(records); pending.set(k, queue); state.pending++;
      if (state.pending > 400) state.failed = true;
    } catch { state.failed = true; }
  });
  page.on('response', async response => {
    try { finish(await response.request(), response.status(), 'http_response'); }
    catch { state.failed = true; }
  });
  page.on('requestfailed', req => {
    try { finish(req, null, 'network_failed'); }
    catch { state.failed = true; }
  });
  return {
    state,
    allowed: req => {
      const records = safe(req);
      return records !== null && records.every(row => row.labelsVerified);
    },
    // Pendiente no significa recibido. No repetir POST ni eventos.
    snapshot: () => ({ rows: rows.slice(), failed: state.failed, pending: state.pending }),
  };
}
