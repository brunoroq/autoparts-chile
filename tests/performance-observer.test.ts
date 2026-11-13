import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { collectEvidence, attachAnalyticsEvidence } from '../performance/k6/browser-evidence.js';
import { observerSpecification, observerCreateArgs, stopOwnedObserver, protectedSnapshot, type Container } from '../scripts/performance-observer-container';
import { sanitizeObserverLog } from '../scripts/performance-observer-evidence';

const environmentId = '324a39f2-2164-44cc-8276-5ef9defec5db';
const experimentId = '12345678-1234-1234-1234-123456789abc';
const id = 'G-BLNW54CZ2R';
function fixtures() {
  const app: Container = {Id:'a'.repeat(64), Name:'/autoparts-performance-app-1', Image:'sha256:'+'d'.repeat(64), RestartCount:0,
    State:{Running:true, Status:'running', StartedAt:'fixture', Health:{Status:'healthy'}},
    Config:{Labels:{'com.docker.compose.project':'autoparts-performance'}, Env:[
      'DATABASE_URL=postgresql://fixture:fixture@postgres:5432/autoparts_performance_test',
      'DIRECT_URL=postgresql://fixture:fixture@postgres:5432/autoparts_performance_test',
      'NEXTAUTH_SECRET=local_fixture_only_01234567890123456789', 'PAYMENT_TOKEN_SECRET=local_fixture_only_01234567890123456789',
      'PERF_ISOLATED=true','ANALYTICS_ENABLED=false','GA4_MEASUREMENT_ID=','GA4_SYNTHETIC_MEASUREMENT_ID=',
      'TRAFFIC_KIND=synthetic','APP_ENV=performance-local','PAYMENT_PROVIDER=simulated','CATALOG_SIZE=30','NEXTAUTH_URL=http://127.0.0.1:3100']},
    HostConfig:{PortBindings:{'3000/tcp':[{HostIp:'127.0.0.1',HostPort:'3100'}]}},
    NetworkSettings:{Networks:{lab:{},ingress:{}},Ports:{'3000/tcp':[{HostIp:'127.0.0.1',HostPort:'3100'}]}}, Mounts:[]};
  const pg: Container = {...structuredClone(app), Id:'b'.repeat(64), Name:'/autoparts-performance-postgres-1',
    Config:{Labels:{'com.docker.compose.project':'autoparts-performance'}, Env:['POSTGRES_DB=autoparts_performance_test','POSTGRES_USER=performance']},
    HostConfig:{PortBindings:{}}, NetworkSettings:{Networks:{lab:{}}},
    Mounts:[{Type:'volume',Name:`autoparts-performance-${environmentId}`,Destination:'/var/lib/postgresql'}]};
  return {app,pg};
}
test('contenedor adicional usa3101 sin mutar originales, credenciales del shell o volúmenes', () => {
  const {app,pg}=fixtures(), before=protectedSnapshot([app,pg]);
  const spec=observerSpecification(app,pg,environmentId,experimentId,id);
  assert.equal(spec.env.NEXTAUTH_URL,'http://127.0.0.1:3101');
  assert.equal(spec.env.GA4_SYNTHETIC_MEASUREMENT_ID,id);
  assert.equal(spec.env.GA4_MEASUREMENT_ID,'');
  assert.equal(spec.env.RESOURCE_METRICS_ENABLED,'false');
  const args=observerCreateArgs(spec,experimentId,'private/observer.env','sha256:'+'e'.repeat(64));
  assert.equal(args[0],'create'); assert.ok(args.includes('127.0.0.1:3101:3000'));
  assert.equal(args.filter(a=>a==='--network').length,2);assert.ok(args.includes('lab')&&args.includes('ingress'));
  assert.ok(args.includes('1g')); assert.ok(args.includes('1'));
  assert.ok(!args.includes('--rm')&&!args.includes('--volume')&&!args.includes('--mount'));
  assert.equal(args.some(a=>a.includes('fixture:fixture')),false);
  assert.equal(protectedSnapshot([app,pg]),before);
  assert.ok(args.at(-1)?.includes('180000'));
});
test('fuente con dominio remoto, IDs oficiales, puerto público o datos fuera del laboratorio se rechaza', () => {
  const {app,pg}=fixtures();
  for(const badId of ['G-VVKYV486NP','bad','']) assert.throws(()=>observerSpecification(app,pg,environmentId,experimentId,badId));
  const badPort=structuredClone(app);badPort.HostConfig.PortBindings['3000/tcp'][0].HostIp='0.0.0.0';
  assert.throws(()=>observerSpecification(badPort,pg,environmentId,experimentId,id));
  const badDb=structuredClone(app);badDb.Config.Env=badDb.Config.Env.map(v=>v.startsWith('DATABASE_URL=')?'DATABASE_URL=postgresql://fixture:fixture@remote.invalid/neondb':v);
  assert.throws(()=>observerSpecification(badDb,pg,environmentId,experimentId,id));
  const publicPg=structuredClone(pg);publicPg.HostConfig.PortBindings={'5432/tcp':[{HostIp:'127.0.0.1',HostPort:'5432'}]};
  assert.throws(()=>observerSpecification(app,publicPg,environmentId,experimentId,id));
});
test('limpieza solo permite stop del contenedor propio y nunca rm/restart sobre originales', () => {
  const {app,pg}=fixtures(), spec=observerSpecification(app,pg,environmentId,experimentId,id);
  const sidecar: Container={...structuredClone(app),Id:'c'.repeat(64),Name:'/'+spec.name,
    Config:{Env:[],Labels:{'autoparts.performance.observer':'true','autoparts.performance.experiment':experimentId}}};
  const commands:string[][]=[];
  const call=(args:string[])=>{commands.push(args);if(args[0]==='inspect')return JSON.stringify([sidecar]);if(args[0]==='stop'){sidecar.State.Running=false;return sidecar.Id;}throw Error('Forbidden command')};
  assert.throws(()=>stopOwnedObserver(call,app.Id,experimentId,[app.Id,pg.Id]));
  assert.equal(commands.length,0);
  stopOwnedObserver(call,sidecar.Id,experimentId,[app.Id,pg.Id]);
  assert.deepEqual(commands.map(c=>c[0]),['inspect','stop','inspect']);
  assert.equal(commands[1].at(-1),sidecar.Id);
  sidecar.Config.Labels['autoparts.performance.experiment']='other';
  assert.throws(()=>stopOwnedObserver(call,sidecar.Id,experimentId,[app.Id,pg.Id]));
  assert.equal(commands.filter(c=>c[0]==='stop').length,1);
});

function wireUrl(event='page_view') {
  return `https://www.google-analytics.com/g/collect?tid=${id}&en=${event}&ep.environment=performance-local&ep.traffic_kind=synthetic&ep.experiment_id=${experimentId}&cid=private_client&sid=private_session&dl=https%3A%2F%2Fprivate.invalid`;
}
test('payload GET/POST/batch produce solo eventos y etiquetas permitidas, sin PII ni IDs cliente', () => {
  const rows=collectEvidence('POST',wireUrl(),'en=view_item\nen=add_to_cart',id,experimentId)!;
  assert.deepEqual(rows.map(r=>r.event),['view_item','add_to_cart']);
  assert.ok(rows.every(r=>r.labelsVerified&&r.measurementId===id));
  assert.ok(!JSON.stringify(rows).includes('private'));
  assert.equal(collectEvidence('GET',wireUrl()+'&tid=G-VVKYV486NP',null,id,experimentId),null);
  assert.equal(collectEvidence('GET',wireUrl('purchase'),null,id,experimentId),null);
  assert.equal(collectEvidence('GET',wireUrl().replace('ep.traffic_kind=synthetic','ep.traffic_kind=human'),null,id,experimentId)?.[0].labelsVerified,false);
});
test('respuestas503 y fallos de red nunca se presentan como recepción exitosa', async () => {
  const page=new EventEmitter(), tracker=attachAnalyticsEvidence(page,id,experimentId);
  const req={method:()=> 'POST',url:()=>wireUrl(),postData:()=>null};
  page.emit('request',req);assert.equal(tracker.state.pending,1);
  page.emit('response',{request:()=>req,status:()=>503});await new Promise(resolve=>setImmediate(resolve));
  assert.equal(tracker.state.rows[0].httpSuccess,false);assert.equal(tracker.state.rows[0].httpStatus,503);
  page.emit('request',req);page.emit('requestfailed',req);
  assert.equal(tracker.state.rows[1].transport,'network_failed');assert.equal(tracker.state.rows[1].httpStatus,null);
  assert.equal(tracker.state.pending,0);assert.ok(!JSON.stringify(tracker.snapshot()).includes('private'));
});
test('evidencia importada rechaza destinos ajenos y no acepta éxito solo por la cola', () => {
  const log=(rows:unknown[])=>JSON.stringify({msg:JSON.stringify({event:'browser_observer',events:['page_view'],network:{rows,pending:0,failed:false},verified:true})});
  assert.equal(sanitizeObserverLog(log([]),id,experimentId)?.verified,false);
  assert.equal(sanitizeObserverLog(log([{event:'view_item',measurementId:'G-VVKYV486NP'}]),id,experimentId),null);
});
test('rama observadora precede cualquier escritura Compose y no contiene órdenes destructivas', () => {
  const source=readFileSync('scripts/run-performance.ts','utf8');
  assert.ok(source.indexOf('await runPerformanceObserver(')<source.indexOf('local.PERF_CONCURRENCY ='));
  const sidecar=readFileSync('scripts/run-performance-observer.ts','utf8');
  assert.doesNotMatch(sidecar,/\[['"](?:rm|restart|remove|down)['"]/);
  assert.doesNotMatch(sidecar,/compose\.env|migrate|db push|seedCatalog/);
  assert.match(sidecar,/--no-stream/);assert.match(sidecar,/assertMemory/);
});
