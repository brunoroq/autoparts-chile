import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync } from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createCwvStudy,validateStudy,cwvWindow,assessVisit,cwvSummary,tenVuCoverage,type Study,type Measurement,type Window } from '../scripts/cwv-protocol';
import { cwvClockReader } from '../scripts/cwv-clock';
import { allocateCwvOutput } from '../scripts/cwv-files';
import { validateCwvContainers,cwvFingerprint } from '../scripts/cwv-isolation';
import type { Container } from '../scripts/performance-observer-container';
import { runCwv } from '../scripts/cwv';
import { cwvImagePaths,warmCwvPages } from '../scripts/cwv-warmup';

const environmentId='324a39f2-2164-44cc-8276-5ef9defec5db',version='157.0.8103.78',epoch=1900000000000;
const study=()=>createCwvStudy(environmentId,'kit-de-ampolletas-led-h7',version);
const temporary=()=>{mkdirSync('tmp',{recursive:true});return mkdtempSync(path.resolve('tmp/cwv-offline-'));};
const save=(file:string,v:unknown)=>writeFileSync(file,JSON.stringify(v),{flag:'wx'});
function sample(s:Study,v=s.visits[0],w=cwvWindow(v.runId,v.condition,epoch)):Measurement {
  const start=w.startMs+20000+(v.slot-1)*35000;
  return {visitId:v.visitId,startedAt:new Date(start).toISOString(),endedAt:new Date(start+25000).toISOString(),timeOriginMs:start,
    chromeVersion:s.chromeVersion,controls:s.controls,foreground:true,finalized:true,source:'manual-devtools',
    observedUrl:s.baseUrl+v.route,consoleErrors:0,httpErrors:0,interactionCount:v.page==='product'?4:3,
    lcpMs:1200,clsScore:0,inpMs:32,trace:`evidence/${v.visitId}.trace.json`,screenshot:`evidence/${v.visitId}.png`};
}
test('matriz30: cinco documentos por página/condición, UUID únicos, bloques2+2+1 y orden alternado',()=>{
  const s=study();validateStudy(s);
  assert.equal(s.visits.length,30);assert.equal(new Set(s.visits.map(v=>v.visitId)).size,30);
  for(const page of ['home','catalog','product'])for(const condition of ['baseline','normal'])assert.equal(s.visits.filter(v=>v.page===page&&v.condition===condition).length,5);
  assert.deepEqual(s.blocks.map(b=>b.order),[['baseline','normal'],['normal','baseline'],['baseline','normal']]);
  for(const patch of [{baseUrl:'https://autoparts-chile.vercel.app'},{catalogSize:1000},{visits:s.visits.slice(1)},
    {blocks:[s.blocks[0],s.blocks[0],s.blocks[2]]},{visits:s.visits.map((v,i)=>i===0?{...v,runId:s.blocks[0].normalRunId}:v)}])assert.throws(()=>validateStudy({...s,...patch} as Study));
  assert.throws(()=>createCwvStudy(environmentId,'../../checkout',version));
});
test('relojfragmentado: solo identifica escenario esperado y no conserva texto libre',()=>{
  const id=randomUUID(),found:Window[]=[],read=cwvClockReader(id,epoch,w=>found.push(w));
  const raw=JSON.stringify({msg:JSON.stringify({event:'cwv_scenario_clock',runId:id,startMs:epoch+1000,cookie:'PRIVATE'})})+'\n';
  read(raw.slice(0,21));read(raw.slice(21));read(raw);
  assert.equal(found.length,1);assert.equal(found[0].startMs,epoch+61000);assert.equal(found[0].endMs,epoch+361000);
  assert.ok(!JSON.stringify(found).includes('PRIVATE'));
  const other=cwvClockReader(id,epoch,w=>found.push(w));other(JSON.stringify({event:'cwv_scenario_clock',runId:randomUUID(),startMs:epoch})+'\n');assert.equal(found.length,1);
});
test('ventanas: excluye antes/después de meseta, controles cambiados, documento incompleto y destino remoto',()=>{
  const s=study(),v=s.visits[0],w=cwvWindow(v.runId,'baseline',epoch),m=sample(s,v,w);
  assert.equal(assessVisit(s,v,m,w).accepted,true);
  for(const patch of [{startedAt:new Date(w.startMs).toISOString()},{endedAt:new Date(w.endMs).toISOString()},
    {chromeVersion:'158.0.0.0'},{controls:{...s.controls,cpuRate:4}},{foreground:false},{finalized:false},
    {timeOriginMs:1},{interactionCount:0},{observedUrl:'https://autoparts-chile.vercel.app/'},{consoleErrors:1},{httpErrors:1}])assert.equal(assessVisit(s,v,{...m,...patch} as Measurement,w).accepted,false);
});
test('INPausente permanece null; CLS cero legítimo y versiones actualizadas no son visitas adicionales',()=>{
  const s=study(),v=s.visits[0],w=cwvWindow(v.runId,'baseline',epoch),m=sample(s,v,w);
  const row=assessVisit(s,v,{...m,inpMs:null},w);assert.equal(row.accepted,false);assert.equal(row.inpMs,null);assert.ok(row.reasons.includes('MISSING_OR_INVALID_INP'));
  assert.equal(assessVisit(s,v,m,w).clsScore,0);
});
test('10VU observados: exige cobertura y rechaza huecos, rampas y falta de extremos',()=>{
  const points=Array.from({length:31},(_,n)=>({at:epoch+n*1000,value:10}));
  assert.equal(tenVuCoverage(points,epoch+1000,epoch+25000),true);
  assert.equal(tenVuCoverage(points.map((p,n)=>n===10?{...p,value:9}:p),epoch+1000,epoch+25000),false);
  assert.equal(tenVuCoverage(points.filter((_,n)=>n<10||n>13),epoch+1000,epoch+25000),false);
  assert.equal(tenVuCoverage(points,epoch-1000,epoch+25000),false);
  assert.equal(tenVuCoverage(points,epoch+1000,epoch+40000),false);
});
test('resumen: mediana correcta con npar, p75 rango cercano, missing no cero y nvisible',()=>{
  const s=study(),v=s.visits[0],w=cwvWindow(v.runId,'baseline',epoch),m=sample(s,v,w);
  const rows=[1,2,3,4].map(lcpMs=>assessVisit(s,v,{...m,lcpMs},w));
  const r=cwvSummary(rows).find(r=>r.page==='home'&&r.condition==='baseline'&&r.metric==='lcpMs')!;
  assert.equal(r.n,4);assert.equal(r.median,2.5);assert.equal(r.p75,3);
  assert.equal(cwvSummary([])[0].median,null);
});
test('salidas nuevas no pisan historial y un UUID repetido se detiene sin sobrescribir',()=>{
  const dir=temporary(),id=randomUUID();mkdirSync(path.join(dir,'normal-closed'));writeFileSync(path.join(dir,'normal-closed','historical'),'unchanged');
  const output=allocateCwvOutput(dir,id);assert.ok(output.endsWith(path.join('measurements',id)));
  assert.throws(()=>allocateCwvOutput(dir,id));assert.throws(()=>allocateCwvOutput(dir,'../../normal-closed'));
  assert.equal(readFileSync(path.join(dir,'normal-closed','historical'),'utf8'),'unchanged');
});
function containers():Container[]{
  const common={Image:'sha256:'+'d'.repeat(64),RestartCount:0,State:{Running:true,Status:'running',StartedAt:'fixture',Health:{Status:'healthy'}},
    Config:{Labels:{'com.docker.compose.project':'autoparts-performance'},Env:[] as string[]},HostConfig:{PortBindings:{}},NetworkSettings:{Networks:{lab:{}}},Mounts:[]};
  const app={...structuredClone(common),Id:'a'.repeat(64),Name:'/autoparts-performance-app-1',Config:{...common.Config,Env:[
    'DATABASE_URL=postgresql://fixture:fixture@postgres:5432/autoparts_performance_test','DIRECT_URL=postgresql://fixture:fixture@postgres:5432/autoparts_performance_test',
    'ANALYTICS_ENABLED=false','GA4_MEASUREMENT_ID=','GA4_SYNTHETIC_MEASUREMENT_ID=','PERF_ISOLATED=true','APP_ENV=performance-local','TRAFFIC_KIND=synthetic','CATALOG_SIZE=30','PAYMENT_PROVIDER=simulated','NEXTAUTH_URL=http://127.0.0.1:3100']},HostConfig:{PortBindings:{'3000/tcp':[{HostIp:'127.0.0.1',HostPort:'3100'}]}}};
  const pg={...structuredClone(common),Id:'b'.repeat(64),Name:'/autoparts-performance-postgres-1',Config:{...common.Config,Env:['POSTGRES_DB=autoparts_performance_test','POSTGRES_USER=performance']},Mounts:[{Type:'volume',Name:'autoparts-performance-'+environmentId,Destination:'/var/lib/postgresql'}]};
  const all:Container[]=[app,pg];all[0].NetworkSettings.Ports={'3000/tcp':[{HostIp:'127.0.0.1',HostPort:'3100'}]};return all;
}
test('aislamiento: Analytics on, IDpresente, BDremota, puerto público o falta de salud bloquean',()=>{
  const all=containers();assert.equal(validateCwvContainers(all,environmentId).pg.Id,'b'.repeat(64));
  for(const env of ['ANALYTICS_ENABLED=true','GA4_MEASUREMENT_ID=G-VVKYV486NP','GA4_SYNTHETIC_MEASUREMENT_ID=G-BLNW54CZ2R','DATABASE_URL=postgresql://fixture:fixture@remote.neon.tech/neondb']) {
    const c=containers();const key=env.split('=')[0];c[0].Config.Env=c[0].Config.Env.filter(e=>!e.startsWith(key+'='));c[0].Config.Env.push(env);assert.throws(()=>validateCwvContainers(c,environmentId));
  }
  const stopped=containers();stopped[0].State.Running=false;assert.throws(()=>validateCwvContainers(stopped,environmentId));
  const ports=containers();ports[1].HostConfig.PortBindings={'5432/tcp':[{HostIp:'0.0.0.0',HostPort:'5432'}]};assert.throws(()=>validateCwvContainers(ports,environmentId));
});
test('huellas solo SELECT con PostgreSQLid validado; sin acciones de reparación',()=>{
  let called=false;cwvFingerprint(args=>{called=true;assert.ok(args.includes('PGOPTIONS=-c default_transaction_read_only=on'));assert.ok(args.at(-1)?.startsWith('SELECT '));assert.ok(!/\b(INSERT|UPDATE|DELETE|TRUNCATE|ALTER|DROP)\b/.test(args.at(-1)!));return '{}';},'b'.repeat(64));assert.equal(called,true);
  assert.throws(()=>cwvFingerprint(()=>{throw new Error('MUST_NOT_RUN');},'postgres-production'));
});
test('CLI protegido sinexecute: baseline y normal nuevos no ejecutan Docker/k6; opciones fuera de alcance bloqueadas',()=>{
  const env={...process.env,DOCKER_BIN:'missing-offline',K6_BIN:'missing-offline'};
  for(const action of ['baseline','plan']) {
    const r=spawnSync(process.execPath,['--import','tsx','scripts/run-performance.ts',action,'--run-id',environmentId,'--profile','normal','--measurement-id',randomUUID(),'--study-id',randomUUID()],{env,encoding:'utf8'});
    assert.equal(r.status,0);assert.equal(JSON.parse(r.stdout).dryRun,true);
  }
  const bad=spawnSync(process.execPath,['--import','tsx','scripts/run-performance.ts','plan','--profile','pico','--measurement-id',randomUUID()],{env,encoding:'utf8'});assert.notEqual(bad.status,0);
});
test('calentamiento con transporte simulado: solo GETloopback, sin JS, redirecciones o imágenes remotas',async()=>{
  const safe='/_next/image?url=%2Fimages%2Fproducts%2Fproduct-01.webp&w=640&q=75';
  assert.deepEqual(cwvImagePaths(`<img src="${safe.replaceAll('&','&amp;')}">`),[safe]);
  assert.deepEqual(cwvImagePaths('<img src="/_next/image?url=https%3A%2F%2Fremote.invalid%2Fa&w=640&q=75">'),[]);
  const urls:string[]=[];const result=await warmCwvPages('/productos/kit-led',(async(url,init)=>{
    urls.push(String(url));assert.ok(String(url).startsWith('http://127.0.0.1:3100/'));assert.equal(init?.redirect,'error');
    return new Response(String(url).includes('/_next/image')?'imagefixture':`<img src="${safe}">`);
  }) as typeof fetch);
  assert.equal(result.requests,4);assert.equal(result.imageVariants,1);assert.equal(urls.length,4);
  await assert.rejects(warmCwvPages('/checkout',(()=>{throw new Error('MUST_NOT_RUN');}) as typeof fetch));
  await assert.rejects(warmCwvPages('/productos/test',(async()=>new Response('',{status:503})) as typeof fetch));
});
test('workflow completo con30fixtures: plan/archivos/exportación; duplicados o rutas privadas rechazados',async()=>{
  const root=temporary();await runCwv(['plan','--environment-id',environmentId,'--product-slug','kit-de-ampolletas-led-h7','--chrome-version',version],root);
  const id=readdirSync(path.join(root,'artifacts/cwv'))[0],dir=path.join(root,'artifacts/cwv',id),s=JSON.parse(readFileSync(path.join(dir,'study.json'),'utf8')) as Study;
  const windows=new Map<string,Window>();let i=0;
  for(const b of s.blocks)for(const condition of b.order){const runId=condition==='baseline'?b.baselineRunId:b.normalRunId,run=allocateCwvOutput(path.join(root,'artifacts/performance',environmentId),runId),w=cwvWindow(runId,condition,epoch+(++i)*500000);windows.set(runId,w);
    save(path.join(run,'cwv-window.json'),w);save(path.join(run,'outcome.json'),{exitCode:0,runError:false,observerFailed:false});save(path.join(run,'data-after.json'),{unchanged:true});save(path.join(run,'manifest.json'),{cwv:{studyId:s.studyId,chromeVersion:s.chromeVersion,serverImage:'sha256:fixture',analytics:false,webVitals:true}});
    if(condition==='normal')writeFileSync(path.join(run,'k6.jsonl'),Array.from({length:305},(_,n)=>JSON.stringify({type:'Point',metric:'vus',data:{time:new Date(w.startMs-2000+n*1000).toISOString(),value:10}})).join('\n'));
  }
  const records=s.visits.map(v=>sample(s,v,windows.get(v.runId)!));for(const m of records){writeFileSync(path.join(dir,m.trace),JSON.stringify({fixture:true,visitId:m.visitId}));writeFileSync(path.join(dir,m.screenshot),'fixture-not-a-real-screenshot');}
  save(path.join(dir,'visits.json'),records);await runCwv(['analyze','--study-id',id,'--input','visits.json'],root);
  const result=path.join(dir,readdirSync(dir).find(n=>n.startsWith('analysis-'))!);const rows=JSON.parse(readFileSync(path.join(result,'visits.json'),'utf8'));
  assert.equal(rows.filter((r:{accepted:boolean})=>r.accepted).length,30);assert.ok(existsSync(path.join(result,'deltas.csv')));
  const summary=JSON.parse(readFileSync(path.join(result,'summary.json'),'utf8'));assert.ok(summary.every((r:{n:number})=>r.n===5));
  save(path.join(dir,'duplicate.json'),[records[0],records[0]]);await assert.rejects(runCwv(['analyze','--study-id',id,'--input','duplicate.json'],root));
  await assert.rejects(runCwv(['analyze','--study-id',id,'--input','../../.env'],root));
});
