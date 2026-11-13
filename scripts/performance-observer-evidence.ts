import type { TransportEvent } from '../performance/k6/browser-evidence.js';

/** Reconstruir únicamente campos permitidos; descartar toda salida cruda de k6. */
export function sanitizeObserverLog(text: string, measurementId: string, experimentId: string) {
  const allowed = new Set(['page_view','view_item','add_to_cart','remove_from_cart','first_visit','session_start','user_engagement','scroll']);
  const results = text.split(/\r?\n/).flatMap(line => {
    try { const outer = JSON.parse(line), data = JSON.parse(outer.msg); return data.event === 'browser_observer' ? [data] : []; }
    catch { return []; }
  });
  if (results.length !== 1) return null;
  const raw = results[0];
  if (!Array.isArray(raw.network?.rows) || raw.network.rows.length > 400 || !Array.isArray(raw.events)) return null;
  const rows: TransportEvent[] = [];
  for (const r of raw.network.rows) {
    if (!allowed.has(r.event) || r.measurementId !== measurementId ||
        ![null, experimentId].includes(r.experimentId) ||
        ![null,'performance-local'].includes(r.environment) || ![null,'synthetic'].includes(r.trafficKind) ||
        !['http_response','network_failed'].includes(r.transport) ||
        !(r.httpStatus === null || Number.isInteger(r.httpStatus) && r.httpStatus >= 100 && r.httpStatus <= 599)) return null;
    const labelsVerified = r.experimentId === experimentId && r.environment === 'performance-local' && r.trafficKind === 'synthetic';
    rows.push({event:r.event, measurementId, experimentId:r.experimentId, environment:r.environment, trafficKind:r.trafficKind,
      labelsVerified, firstVisitFlag:r.firstVisitFlag === true, sessionStartFlag:r.sessionStartFlag === true,
      httpStatus:r.httpStatus, transport:r.transport, httpSuccess:r.transport === 'http_response' && r.httpStatus >= 200 && r.httpStatus < 300,
      googleIngestionConfirmed:false});
  }
  const events = raw.events.filter((n: unknown) => typeof n === 'string' && allowed.has(n));
  const pending = Number.isInteger(raw.network.pending) && raw.network.pending >= 0 && raw.network.pending <= 400 ? raw.network.pending : 400;
  const verified = raw.verified === true && raw.network.failed === false && pending === 0 &&
    raw.consent === 'granted' && raw.javascript === true &&
    JSON.stringify(raw.steps) === JSON.stringify(['home','consent','catalog','product','add_to_cart','cart','remove_from_cart','empty_cart']) &&
    rows.every(r => r.httpSuccess && r.labelsVerified) && rows.filter(r => r.event === 'page_view').length === 4 &&
    ['view_item','add_to_cart','remove_from_cart'].every(name => rows.filter(r => r.event === name).length === 1);
  const stages = ['context','network_policy','isolation','home','consent','catalog','product','add_to_cart','cart','remove_from_cart','empty_cart','transport'];
  const steps = Array.isArray(raw.steps) ? raw.steps.filter((s: unknown) => typeof s === 'string' && stages.includes(s)).slice(0,12) : [];
  return {events, network:{rows,pending,failed:raw.network.failed !== false}, verified, stage:stages.includes(raw.stage) ? raw.stage : 'unknown',
    consent:raw.consent === 'granted' ? 'granted' : 'unconfirmed', javascript:raw.javascript === true, steps,
    evidence:'http_transport_not_google_report', googleInterfaceConfirmed:false};
}
