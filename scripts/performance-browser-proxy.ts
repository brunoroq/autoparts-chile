import { createServer, type OutgoingHttpHeaders } from 'node:http';
import { request } from 'node:http';
import { connect } from 'node:net';
import type { Socket } from 'node:net';
import { BROWSER_LIMITS, browserRequestAllowed, googleHost } from '../performance/k6/browser-policy.js';

/** Proxy loopback del observador. No guarda URLs, cuerpos, cookies o cabeceras. */
export async function browserProxy(deadline: number, stop: () => void) {
  let requests = 0, tunnels = 0, bytes = 0, blocked = 0;
  const sockets = new Set<Socket>();
  const guard = () => Date.now() < deadline && requests <= BROWSER_LIMITS.requests &&
    tunnels <= BROWSER_LIMITS.tunnels && bytes <= BROWSER_LIMITS.bytes;
  const fail = () => { blocked++; stop(); };
  const server = createServer(async (req, res) => {
    requests++;
    if (!guard() || !browserRequestAllowed(req.method || '', req.url || '')) {
      // Next puede precargar enlaces fuera del recorrido sin que el usuario los abra.
      // No reenviar esa lectura ni interpretarla como una visita/compra.
      if (guard() && req.method === 'GET' && req.headers['next-router-prefetch'] === '1') {
        res.writeHead(204); res.end(); return;
      }
      fail(); res.writeHead(403); res.end(); return;
    }
    const body: Buffer[] = [];
    for await (const chunk of req) {
      const b = Buffer.from(chunk); bytes += b.length; body.push(b);
      if (!guard() || Buffer.concat(body).length > 4096) { fail(); res.writeHead(413); res.end(); return; }
    }
    if (req.method === 'POST') {
      try {
        const value = JSON.parse(Buffer.concat(body).toString());
        if (!Array.isArray(value.items) || value.items.length !== 1 || value.items[0].quantity !== 1 ||
            !/^[a-f0-9-]{36}$/.test(value.items[0].productId)) throw new Error();
      } catch { fail(); res.writeHead(400); res.end(); return; }
    }
    const target = new URL(req.url!);
    const headers: OutgoingHttpHeaders = { ...req.headers, host: target.host };
    delete headers['proxy-authorization']; delete headers['proxy-connection'];
    const outgoing = request({ hostname: '127.0.0.1', port: 3100, path: target.pathname + target.search,
      method: req.method, headers, timeout: 15000 }, upstream => {
      res.writeHead(upstream.statusCode || 502, upstream.headers);
      upstream.on('data', b => { bytes += b.length; if (!guard()) { fail(); outgoing.destroy(); res.destroy(); } });
      upstream.pipe(res);
    });
    outgoing.on('timeout', () => outgoing.destroy());
    outgoing.on('error', () => { fail(); if (!res.headersSent) res.writeHead(502); res.end(); });
    outgoing.end(Buffer.concat(body));
  });
  server.on('connection', socket => { sockets.add(socket); socket.on('close', () => sockets.delete(socket)); });
  server.on('connect', (req, client, head) => {
    const [host, port, extra] = (req.url || '').split(':');
    tunnels++;
    if (extra || port !== '443' || !googleHost(host) || !guard()) { fail(); client.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return; }
    // TLS se negocia extremo a extremo en Chrome: no se deshabilitan certificados.
    const upstream = connect(443, host);
    sockets.add(upstream); upstream.on('close', () => sockets.delete(upstream));
    upstream.setTimeout(15000, () => upstream.destroy());
    upstream.on('connect', () => { client.write('HTTP/1.1 200 Connection Established\r\n\r\n'); upstream.write(head); client.pipe(upstream); upstream.pipe(client); });
    for (const socket of [client, upstream]) socket.on('data', b => { bytes += b.length; if (!guard()) { fail(); client.destroy(); upstream.destroy(); } });
    upstream.on('error', () => { fail(); client.destroy(); });
    client.on('error', () => upstream.destroy());
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Proxy no disponible.');
  return { port: address.port, stats: () => ({ requests, tunnels, bytes, blocked }),
    close: async () => { for (const socket of sockets) socket.destroy(); await new Promise<void>(resolve => server.close(() => resolve())); } };
}
