const phases = new Set(['preflight','preparation','browser_launch','context','network_policy','local_navigation','consent','gtag_script','https_connect','analytics_event','transport','cleanup']);
const codes = new Set([
  'RUNNER_PHASE','K6_SPAWN_REQUESTED','K6_SPAWN_ERROR','K6_PROCESS_CLOSED','K6_RUNTIME_ERROR','WATCHDOG_STOP','RESOURCE_STOP','DIAGNOSTIC_INPUT_DROPPED',
  'BROWSER_LAUNCH_REQUESTED','BROWSER_CONTEXT_READY','BROWSER_PAGE_READY','BROWSER_ACTION_FAILED','LOCAL_NAVIGATION_STARTED','LOCAL_HTTP_RESPONSE',
  'CONSENT_ACTION_REQUESTED','CONSENT_GRANTED','GTAG_READY_WAIT','GTAG_QUEUE_READY','GTAG_SCRIPT_REQUESTED','GTAG_SCRIPT_HTTP','GTAG_SCRIPT_FAILED',
  'NETWORK_POLICY_BLOCKED','NETWORK_LIMIT_STOP','ANALYTICS_REQUEST','ANALYTICS_HTTP_RESPONSE','ANALYTICS_REQUEST_FAILED',
  'PROXY_LISTENING','PROXY_HTTP_REQUEST','PROXY_HTTP_ACCEPTED','PROXY_PREFETCH_SUPPRESSED','PROXY_POLICY_BLOCKED','PROXY_LIMIT_STOP','PROXY_PAYLOAD_REJECTED',
  'PROXY_LOCAL_RESPONSE','PROXY_LOCAL_CONNECT_ERROR','PROXY_LOCAL_TIMEOUT','PROXY_LOCAL_STREAM_ERROR','PROXY_CONNECT_REQUEST','PROXY_TUNNEL_ESTABLISHED',
  'PROXY_CONNECT_ERROR','PROXY_TUNNEL_TIMEOUT','PROXY_CLIENT_ERROR','PROXY_PROTOCOL_ERROR','PROXY_CLOSED',
]);
const reasons = new Set(['NONE','OTHER','MALFORMED_URL','LOCAL_ROUTE_BLOCKED','LOCAL_ORIGIN_BLOCKED','REMOTE_HTTP_BLOCKED','REMOTE_HOST_BLOCKED','HTTPS_REQUIRED',
  'METHOD_BLOCKED','GOOGLE_PATH_BLOCKED','MEASUREMENT_ID_INVALID','OFFICIAL_ID_BLOCKED','OTHER_ID_BLOCKED','MEASUREMENT_ID_MISSING','MALFORMED_PARAMETERS',
  'DEADLINE_EXCEEDED','REQUEST_LIMIT','TUNNEL_LIMIT','BYTE_LIMIT','BODY_TOO_LARGE','GUEST_PAYLOAD_INVALID','CONNECT_AUTHORITY_INVALID','LABELS_OR_PAYLOAD_INVALID',
  'HOST_MEMORY_LOW','RESOURCE_OR_HEALTH_CHECK','BROWSER_TIMEOUT','BROWSER_CERTIFICATE_ERROR','BROWSER_PROXY_ERROR','BROWSER_DNS_ERROR','BROWSER_EXECUTABLE_ERROR','BROWSER_LAUNCH_ERROR','BROWSER_ACTION_ERROR']);
const targets = new Set(['local_home','local_catalog','local_product','local_cart','local_quote','local_cart_api','local_isolation','local_asset','local_forbidden','local_other_port',
  'google_script','google_collect','google_other_path','chrome_auxiliary','external','invalid']);
const errnos = new Set(['ECONNREFUSED','ECONNRESET','ETIMEDOUT','ENOTFOUND','EAI_AGAIN','EPIPE','ENOENT','EACCES','EPERM','ERR_STREAM_PREMATURE_CLOSE','OTHER']);
const events = new Set(['page_view','view_item','add_to_cart','remove_from_cart','first_visit','session_start','user_engagement','scroll']);

/** Clasificar en memoria; jamás devolver el mensaje original de Chrome/Node. */
export function browserErrorCode(error) {
  const value = typeof error === 'string' ? error : String(error?.message || '');
  if (/ERR_CERT_|ERR_SSL_|certificate/i.test(value)) return 'BROWSER_CERTIFICATE_ERROR';
  if (/ERR_PROXY_|ERR_TUNNEL_|proxy connection/i.test(value)) return 'BROWSER_PROXY_ERROR';
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|EAI_AGAIN/i.test(value)) return 'BROWSER_DNS_ERROR';
  if (/executable|browser.*not found|finding browser|GetFileAttributes/i.test(value)) return 'BROWSER_EXECUTABLE_ERROR';
  if (/launching browser|launch.*chrome|process.*unexpectedly/i.test(value)) return 'BROWSER_LAUNCH_ERROR';
  if (/timeout|timed out/i.test(value)) return 'BROWSER_TIMEOUT';
  return 'BROWSER_ACTION_ERROR';
}
export function socketErrorCode(error) { return errnos.has(error?.code) ? error.code : 'OTHER'; }

/** Lista cerrada: ningún texto libre, URL, IP, cabecera o identificador de cliente. */
export class BrowserDiagnostics {
  constructor(options = {}) {
    this.phase = 'preflight'; this.rows = []; this.dropped = 0;
    this.firstFailure = null; this.now = options.now || Date.now;
    this.startedAt = this.now(); this.sink = options.sink;
    this.measurementId = /^G-[A-Z0-9]{5,20}$/.test(options.measurementId || '') && options.measurementId !== 'G-VVKYV486NP' ? options.measurementId : '';
  }
  record(code, fields = {}) {
    if (!codes.has(code)) { this.dropped++; return null; }
    if (phases.has(fields.phase)) this.phase = fields.phase;
    // Reservar el último lugar para la primera causa fatal, aun con muchos assets.
    if (this.rows.length >= 256 || (this.rows.length >= 255 && (!fields.fatal || this.firstFailure))) { this.dropped++; return null; }
    const row = {event:'observer_diagnostic', sequence:this.rows.length + 1, elapsedMs:Math.max(0,Math.round(this.now()-this.startedAt)), code, phase:this.phase};
    if (['runner','proxy','browser'].includes(fields.source)) row.source = fields.source;
    if (targets.has(fields.target)) row.target = fields.target;
    if (['GET','POST','CONNECT','OTHER'].includes(fields.method)) row.method = fields.method;
    if (reasons.has(fields.reason)) row.reason = fields.reason;
    if (errnos.has(fields.errno)) row.errno = fields.errno;
    if (typeof fields.fatal === 'boolean') row.fatal = fields.fatal;
    if (events.has(fields.analyticsEvent)) row.analyticsEvent = fields.analyticsEvent;
    if (this.measurementId && fields.measurementId === this.measurementId) row.measurementId = this.measurementId;
    for (const key of ['requests','tunnels','bytes','blocked','established','transportErrors','httpStatus','exitCode','pending']) {
      if (Number.isSafeInteger(fields[key]) && fields[key] >= 0 && fields[key] <= 2147483647) row[key] = fields[key];
    }
    if (fields.exitCode === null) row.exitCode = null;
    if (['SIGTERM','SIGKILL','SIGINT','OTHER'].includes(fields.signal)) row.signal = fields.signal;
    Object.freeze(row); this.rows.push(row);
    if (row.fatal && !this.firstFailure) this.firstFailure = row;
    this.sink?.(row);
    return row;
  }
  snapshot() { return {phase:this.phase, firstFailure:this.firstFailure, dropped:this.dropped, events:this.rows.slice()}; }
}
