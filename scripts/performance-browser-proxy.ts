import { createServer, type OutgoingHttpHeaders } from 'node:http';
import { request } from 'node:http';
import { connect } from 'node:net';
import type { Socket } from 'node:net';
import { BROWSER_LIMITS, browserRequestAllowed, diagnosticTarget, googleHost } from '../performance/k6/browser-policy.js';
import { BrowserDiagnostics, socketErrorCode } from '../performance/k6/browser-diagnostics.js';

type Dependencies = {diagnostics?: BrowserDiagnostics; request?: typeof request; connect?: typeof connect};
/** Límites fijos comprobables sin generar carga ni conexiones externas. */
export function proxyLimitReason(deadline: number, counts: {requests:number; tunnels:number; bytes:number}, now = Date.now()) {
  if (now >= deadline) return 'DEADLINE_EXCEEDED';
  if (counts.requests > BROWSER_LIMITS.requests) return 'REQUEST_LIMIT';
  if (counts.tunnels > BROWSER_LIMITS.tunnels) return 'TUNNEL_LIMIT';
  if (counts.bytes > BROWSER_LIMITS.bytes) return 'BYTE_LIMIT';
  return null;
}

/** Proxy loopback del observador. No guarda URLs, cuerpos, cookies o cabeceras. */
export async function browserProxy(deadline: number, stop: () => void, dependencies: Dependencies = {}) {
  let requests = 0, tunnels = 0, bytes = 0, blocked = 0;
  const sockets = new Set<Socket>();
  let established = 0, transportErrors = 0, policyBlocks = 0;
  const diagnostics = dependencies.diagnostics || new BrowserDiagnostics();
  const counts = () => ({requests, tunnels, bytes, blocked, established, transportErrors});
  const record = (code: string, fields: Record<string, unknown> = {}) => diagnostics.record(code, {source:'proxy', ...counts(), ...fields});
  const fail = (code: string, fields: Record<string, unknown> = {}) => {
    blocked++;
    if (code === 'PROXY_POLICY_BLOCKED' || code === 'PROXY_PAYLOAD_REJECTED') policyBlocks++;
    else if (code !== 'PROXY_LIMIT_STOP') transportErrors++;
    // Registrar antes de detener el navegador, conservando la primera causa.
    record(code, {...fields, fatal:true}); stop();
  };
  const guard = () => {
    const reason = proxyLimitReason(deadline, counts());
    if (reason) { fail('PROXY_LIMIT_STOP', {reason}); return false; }
    return true;
  };
  const server = createServer(async (req, res) => {
    requests++;
    const targetClass = diagnosticTarget(req.url || '');
    record('PROXY_HTTP_REQUEST', {target:targetClass, method:req.method});
    if (!guard()) { res.writeHead(403); res.end(); return; }
    if (!browserRequestAllowed(req.method || '', req.url || '')) {
      // Next puede precargar enlaces fuera del recorrido sin que el usuario los abra.
      // No reenviar esa lectura ni interpretarla como una visita/compra.
      if (req.method === 'GET' && req.headers['next-router-prefetch'] === '1' && (req.url || '').startsWith('http://127.0.0.1:3101/')) {
        record('PROXY_PREFETCH_SUPPRESSED', {target:targetClass, httpStatus:204}); res.writeHead(204); res.end(); return;
      }
      fail('PROXY_POLICY_BLOCKED', {target:targetClass, method:req.method, reason:targetClass.startsWith('local_') ? 'LOCAL_ROUTE_BLOCKED' : 'REMOTE_HTTP_BLOCKED'}); res.writeHead(403); res.end(); return;
    }
    const body: Buffer[] = [];
    try {
      for await (const chunk of req) {
        const b = Buffer.from(chunk); bytes += b.length; body.push(b);
        if (!guard()) { res.writeHead(413); res.end(); return; }
        if (Buffer.concat(body).length > 4096) { fail('PROXY_PAYLOAD_REJECTED', {reason:'BODY_TOO_LARGE', target:targetClass}); res.writeHead(413); res.end(); return; }
      }
    } catch (error) { fail('PROXY_CLIENT_ERROR', {target:targetClass, errno:socketErrorCode(error)}); res.destroy(); return; }
    if (req.method === 'POST') {
      try {
        const value = JSON.parse(Buffer.concat(body).toString());
        if (!Array.isArray(value.items) || value.items.length !== 1 || value.items[0].quantity !== 1 ||
            !/^[a-f0-9-]{36}$/.test(value.items[0].productId)) throw new Error();
      } catch { fail('PROXY_PAYLOAD_REJECTED', {reason:'GUEST_PAYLOAD_INVALID', target:targetClass}); res.writeHead(400); res.end(); return; }
    }
    const target = new URL(req.url!);
    const headers: OutgoingHttpHeaders = { ...req.headers, host: target.host };
    delete headers['proxy-authorization']; delete headers['proxy-connection'];
    record('PROXY_HTTP_ACCEPTED', {target:targetClass, method:req.method});
    let upstreamFailed = false;
    const upstreamFailure = (code: string, error?: unknown) => {
      if (upstreamFailed) return; upstreamFailed = true;
      fail(code, {target:targetClass, errno:socketErrorCode(error)});
      if (!res.headersSent) res.writeHead(502); res.end();
    };
    const outgoing = (dependencies.request || request)({ hostname: '127.0.0.1', port: 3101, path: target.pathname + target.search,
      method: req.method, headers, timeout: 15000 }, upstream => {
      record('PROXY_LOCAL_RESPONSE', {target:targetClass, httpStatus:upstream.statusCode || 502});
      res.writeHead(upstream.statusCode || 502, upstream.headers);
      upstream.on('error', error => upstreamFailure('PROXY_LOCAL_STREAM_ERROR', error));
      upstream.on('data', b => { bytes += b.length; if (!guard()) { outgoing.destroy(); res.destroy(); } });
      upstream.pipe(res);
    });
    outgoing.on('timeout', () => { upstreamFailure('PROXY_LOCAL_TIMEOUT', {code:'ETIMEDOUT'}); outgoing.destroy(); });
    outgoing.on('error', error => upstreamFailure('PROXY_LOCAL_CONNECT_ERROR', error));
    outgoing.end(Buffer.concat(body));
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.on('clientError', (error, socket) => { fail('PROXY_PROTOCOL_ERROR', {errno:socketErrorCode(error)}); socket.destroy(); });
  server.on('connect', (req, client, head) => {
    const [host, port, extra] = (req.url || '').split(':');
    tunnels++;
    record('PROXY_CONNECT_REQUEST', {phase:'https_connect', method:'CONNECT', target:googleHost(host) ? host === 'www.googletagmanager.com' ? 'google_script' : 'google_collect' : 'external'});
    if (!guard()) { client.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    if (extra || port !== '443' || !googleHost(host)) { fail('PROXY_POLICY_BLOCKED', {reason:extra || port !== '443' ? 'CONNECT_AUTHORITY_INVALID' : 'REMOTE_HOST_BLOCKED'}); client.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    // TLS se negocia extremo a extremo en Chrome: no se deshabilitan certificados.
    const upstream = (dependencies.connect || connect)(443, host);
    let tunnelFailed = false;
    sockets.add(upstream); upstream.on('close', () => sockets.delete(upstream));
    upstream.setTimeout(15000, () => { if (!tunnelFailed) { tunnelFailed = true; fail('PROXY_TUNNEL_TIMEOUT', {errno:'ETIMEDOUT'}); } upstream.destroy(); client.destroy(); });
    upstream.on('connect', () => { established++; record('PROXY_TUNNEL_ESTABLISHED'); client.write('HTTP/1.1 200 Connection Established\r\n\r\n'); upstream.write(head); client.pipe(upstream); upstream.pipe(client); });
    for (const socket of [client, upstream]) socket.on('data', b => { bytes += b.length; if (!guard()) { client.destroy(); upstream.destroy(); } });
    upstream.on('error', error => { if (!tunnelFailed) { tunnelFailed = true; fail('PROXY_CONNECT_ERROR', {errno:socketErrorCode(error)}); } client.destroy(); });
    client.on('error', error => { if (!tunnelFailed) { tunnelFailed = true; fail('PROXY_CLIENT_ERROR', {errno:socketErrorCode(error)}); } upstream.destroy(); });
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Proxy no disponible.');
  record('PROXY_LISTENING');
  return { port: address.port, stats: () => ({ ...counts(), policyBlocks, diagnostics:diagnostics.snapshot() }),
    close: async () => { for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); record('PROXY_CLOSED'); } };
}
