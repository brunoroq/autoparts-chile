import test from 'node:test';
import assert from 'node:assert/strict';
import { request, type IncomingMessage } from 'node:http';
import { connect, type Socket } from 'node:net';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { BrowserDiagnostics, browserErrorCode } from '../performance/k6/browser-diagnostics.js';
import { browserNetworkDecision, diagnosticTarget, BROWSER_LIMITS } from '../performance/k6/browser-policy.js';
import { browserProxy, proxyLimitReason } from '../scripts/performance-browser-proxy';
import { diagnosticStream } from '../scripts/performance-observer-diagnostics';

const id = 'G-BLNW54CZ2R';
// Únicamente el cliente del test usa sockets loopback efímeros. Todo upstream es simulado.
function local(port: number, path = 'http://127.0.0.1:3101/', prefetch = false) {
  return new Promise<number>(resolve => {
    const req = request({hostname:'127.0.0.1', port, path, headers:prefetch ? {'next-router-prefetch':'1'} : {}}, res => { res.resume(); res.on('end', () => resolve(res.statusCode!)); });
    req.on('error', () => resolve(0)); req.end();
  });
}
function fakeHttp(mode: 'ok'|'refused'|'timeout') {
  return ((_options: unknown, callback: (response: IncomingMessage) => void) => {
    const outgoing = new EventEmitter() as EventEmitter & {end:()=>void; destroy:()=>void};
    outgoing.destroy = () => {};
    outgoing.end = () => queueMicrotask(() => {
      if (mode === 'refused') { outgoing.emit('error', Object.assign(new Error('PRIVATE must not persist'), {code:'ECONNREFUSED'})); return; }
      if (mode === 'timeout') { outgoing.emit('timeout'); return; }
      const upstream = new PassThrough() as unknown as IncomingMessage;
      upstream.statusCode = 200; upstream.headers = {};
      callback(upstream); (upstream as unknown as PassThrough).end('fixture');
    });
    return outgoing;
  }) as unknown as typeof request;
}

test('diagnósticos: esquema cerrado, primera causa y límite sin datos sensibles', () => {
  const d = new BrowserDiagnostics({measurementId:id, now:()=>10});
  d.record('PROXY_POLICY_BLOCKED', {phase:'network_policy', fatal:true, reason:'REMOTE_HOST_BLOCKED', target:'external', url:'PRIVATE', cookie:'PRIVATE', measurementId:'G-VVKYV486NP'});
  d.record('BROWSER_ACTION_FAILED', {reason:'BROWSER_TIMEOUT', fatal:true, phase:'PRIVATE'});
  for (let i=0;i<300;i++) d.record('PROXY_HTTP_REQUEST');
  assert.ok(d.snapshot().events.length <= 256);
  assert.equal(d.snapshot().firstFailure?.code,'PROXY_POLICY_BLOCKED');
  assert.equal(d.snapshot().phase,'network_policy');
  assert.ok(d.snapshot().dropped > 0);
  assert.ok(!JSON.stringify(d.snapshot()).includes('PRIVATE'));
  assert.ok(!JSON.stringify(d.snapshot()).includes('G-VVKYV486NP'));
  const full = new BrowserDiagnostics();
  for (let i=0;i<300;i++) full.record('PROXY_HTTP_REQUEST');
  full.record('PROXY_CONNECT_ERROR', {fatal:true, errno:'ECONNRESET'});
  assert.equal(full.snapshot().firstFailure?.errno,'ECONNRESET');
});
test('stream de k6: fragmentos, errores clasificados y ausencia de texto crudo', () => {
  const d = new BrowserDiagnostics({measurementId:id}), stream = diagnosticStream(d);
  const line = JSON.stringify({msg:JSON.stringify({event:'observer_diagnostic', code:'BROWSER_CONTEXT_READY', phase:'context', url:'PRIVATE'})})+'\n';
  stream.consume(line.slice(0,20)); stream.consume(line.slice(20));
  stream.consume(JSON.stringify({level:'error',msg:'timeout https://PRIVATE?secret=PRIVATE'})); stream.flush();
  assert.equal(d.snapshot().events[0].code,'BROWSER_CONTEXT_READY');
  assert.equal(d.snapshot().firstFailure?.reason,'BROWSER_TIMEOUT');
  assert.ok(!JSON.stringify(d.snapshot()).includes('PRIVATE'));
  assert.equal(browserErrorCode('ERR_CERT_AUTHORITY_INVALID PRIVATE'),'BROWSER_CERTIFICATE_ERROR');
  assert.equal(browserErrorCode('ERR_PROXY_CONNECTION_FAILED'),'BROWSER_PROXY_ERROR');
  assert.equal(browserErrorCode('browser executable not found'),'BROWSER_EXECUTABLE_ERROR');
});
test('red: ID oficial y alternativos bloqueados en query, cuerpo y lote; destinos mínimos', () => {
  const base = 'https://www.google-analytics.com/g/collect?tid='+id;
  assert.equal(browserNetworkDecision('POST',base,'en=page_view',id).allowed,true);
  for (const body of ['tid=G-VVKYV486NP','en=page_view\ntid=G-OTHER12345','send_to=G%2DVVKYV486NP']) assert.equal(browserNetworkDecision('POST',base,body,id).allowed,false);
  assert.equal(browserNetworkDecision('GET','https://www.googletagmanager.com/gtag/js?id='+id,null,id).allowed,true);
  assert.equal(browserNetworkDecision('GET','https://www.google-analytics.com/g/collect',null,id).reason,'MEASUREMENT_ID_MISSING');
  assert.equal(browserNetworkDecision('GET','http://www.google-analytics.com/g/collect?tid='+id,null,id).reason,'HTTPS_REQUIRED');
  for (const url of ['http://127.0.0.1:3100/','https://evil.invalid/','https://clients2.google.com/time/1']) assert.equal(browserNetworkDecision('GET',url,null,id).allowed,false);
  assert.equal(diagnosticTarget('https://clients2.google.com/time/1?secret=PRIVATE'),'chrome_auxiliary');
});
test('límites fijos: tiempo, solicitudes, túneles y transferencia', () => {
  const c = {requests:0,tunnels:0,bytes:0};
  assert.equal(proxyLimitReason(100,c,99),null);
  assert.equal(proxyLimitReason(100,c,100),'DEADLINE_EXCEEDED');
  for (const [key,reason] of [['requests','REQUEST_LIMIT'],['tunnels','TUNNEL_LIMIT'],['bytes','BYTE_LIMIT']] as const) assert.equal(proxyLimitReason(100,{...c,[key]:BROWSER_LIMITS[key]+1},0),reason);
});
for (const mode of ['ok','refused','timeout'] as const) test(`proxy upstream simulado: ${mode}`, async () => {
  let stops = 0;
  const p = await browserProxy(Date.now()+5000,()=>{stops++;},{request:fakeHttp(mode)});
  try {
    assert.equal(await local(p.port), mode === 'ok' ? 200 : 502);
    const s = p.stats(); assert.equal(stops,mode === 'ok' ? 0 : 1);
    if (mode === 'ok') assert.ok(s.diagnostics.events.some(r=>r.code === 'PROXY_LOCAL_RESPONSE' && r.httpStatus===200));
    else assert.equal(s.diagnostics.firstFailure?.code,mode==='refused'?'PROXY_LOCAL_CONNECT_ERROR':'PROXY_LOCAL_TIMEOUT');
    assert.equal(s.policyBlocks,0);
    assert.ok(!JSON.stringify(s).includes('PRIVATE'));
  } finally { await p.close(); }
});
test('proxy: rechazo externo incluso con prefetch y sin invocar transporte', async () => {
  let forwarded = false;
  const p = await browserProxy(Date.now()+5000,()=>{}, {request:(()=>{forwarded=true;throw new Error();}) as unknown as typeof request});
  try {
    assert.equal(await local(p.port,'http://clients2.google.com/time/1?secret=PRIVATE',true),403);
    assert.equal(forwarded,false);
    assert.equal(p.stats().diagnostics.firstFailure?.reason,'REMOTE_HTTP_BLOCKED');
    assert.equal(p.stats().diagnostics.firstFailure?.target,'chrome_auxiliary');
  } finally { await p.close(); }
});
test('proxy CONNECT: DNS simulado y errno saneado; cero conexión real a Google', async () => {
  const fakeConnect = (() => {
    const socket = new PassThrough() as unknown as Socket;
    socket.setTimeout = () => socket;
    queueMicrotask(()=>socket.emit('error',Object.assign(new Error('PRIVATE'),{code:'ENOTFOUND'})));
    return socket;
  }) as unknown as typeof connect;
  const p = await browserProxy(Date.now()+5000,()=>{}, {connect:fakeConnect});
  try {
    await new Promise<void>(resolve=>{
      const client = connect(p.port,'127.0.0.1',()=>client.write('CONNECT www.google-analytics.com:443 HTTP/1.1\r\nHost: www.google-analytics.com:443\r\n\r\n'));
      client.on('error',()=>{}); client.on('close',()=>resolve());
    });
    assert.equal(p.stats().established,0);
    assert.equal(p.stats().diagnostics.firstFailure?.code,'PROXY_CONNECT_ERROR');
    assert.equal(p.stats().diagnostics.firstFailure?.errno,'ENOTFOUND');
  } finally { await p.close(); }
});
