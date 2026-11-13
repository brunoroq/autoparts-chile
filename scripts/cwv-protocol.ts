import { randomUUID } from 'node:crypto';
import { BASE_URL } from '../performance/k6/safety.js';

export const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
export const CWV_CONTROLS = Object.freeze({width:1440, height:900, dpr:1, cpuRate:1,
  network:'unthrottled', browserCache:'disabled', storage:'cleared-before-document', serverCache:'warm'});
export type Condition = 'baseline'|'normal';
export type Visit = {visitId:string; runId:string; block:number; condition:Condition; page:'home'|'catalog'|'product'; route:string; repetition:number; slot:number};
export type Study = {version:1; studyId:string; environmentId:string; baseUrl:string; catalogSize:30; chromeVersion:string;
  controls:typeof CWV_CONTROLS; plannedVisits:30; visits:Visit[]; blocks:{block:number; order:Condition[]; baselineRunId:string; normalRunId:string}[]};
export type Window = {event:'cwv_window'; runId:string; condition:Condition; startMs:number; endMs:number; source:'baseline-clock'|'k6-scenario'; guardMs:number};
export type Gauge = {at:number; value:number};
export type Measurement = {visitId:string; startedAt:string; endedAt:string; timeOriginMs:number; chromeVersion:string;
  controls:typeof CWV_CONTROLS; foreground:boolean; finalized:boolean; interactionCount:number;
  source:'manual-devtools'; observedUrl:string; consoleErrors:number; httpErrors:number;
  lcpMs:number|null; clsScore:number|null; inpMs:number|null; trace:string; screenshot:string};

/** Plan sin HTTP/procesos externos. Los UUID distinguen estudio, corrida y documento. */
export function createCwvStudy(environmentId:string, productSlug:string, chromeVersion:string, id=()=>randomUUID()): Study {
  if (!uuid.test(environmentId) || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productSlug) || !/^\d+\.\d+\.\d+\.\d+$/.test(chromeVersion)) throw new Error('CWV_PLAN_INVALID');
  const studyId=id(), blocks:Study['blocks']=[], visits:Visit[]=[];
  let repetition=0;
  for (let block=1;block<=3;block++) {
    const baselineRunId=id(), normalRunId=id();
    const order:Condition[]=block===2?['normal','baseline']:['baseline','normal'];
    blocks.push({block,order,baselineRunId,normalRunId});
    const count=block===3?1:2;
    for(const condition of order) {
      let slot=0;
      for(let n=0;n<count;n++) {
        // Rotar páginas entre bloques; no confundir efecto de orden con carga.
        const pages:Visit['page'][]=block===2?['product','catalog','home']:['home','catalog','product'];
        for(const page of pages) visits.push({visitId:id(),runId:condition==='normal'?normalRunId:baselineRunId,block,condition,page,
          route:page==='home'?'/':page==='catalog'?'/catalogo':'/productos/'+productSlug,repetition:repetition+n+1,slot:++slot});
      }
    }
    repetition+=count;
  }
  return {version:1,studyId,environmentId,baseUrl:BASE_URL,catalogSize:30,chromeVersion,controls:CWV_CONTROLS,plannedVisits:30,visits,blocks};
}
export function sameControls(value:unknown) {
  if (!value || typeof value!=='object') return false;
  return Object.entries(CWV_CONTROLS).every(([key,v])=>(value as Record<string,unknown>)[key]===v);
}
export function validateStudy(study:Study) {
  if(study.version!==1 || !uuid.test(study.studyId) || !uuid.test(study.environmentId) || study.baseUrl!==BASE_URL ||
    study.catalogSize!==30 || !sameControls(study.controls) || !/^\d+\.\d+\.\d+\.\d+$/.test(study.chromeVersion) ||
    study.plannedVisits!==30 || !Array.isArray(study.visits) || study.visits.length!==30 || study.blocks?.length!==3) throw new Error('CWV_STUDY_INVALID');
  const ids=new Set<string>([study.studyId,study.environmentId]);
  for(const [index,b] of study.blocks.entries()) {
    if(b.block!==index+1 || JSON.stringify(b.order)!==JSON.stringify(b.block===2?['normal','baseline']:['baseline','normal']))throw new Error('CWV_BLOCK_ORDER_INVALID');
    for(const id of [b.baselineRunId,b.normalRunId]) {if(!uuid.test(id)||ids.has(id))throw new Error('CWV_IDS_INVALID');ids.add(id);}
  }
  const groups=new Map<string,Set<number>>();
  const slots=new Set<string>(),productRoutes=new Set<string>();
  for(const v of study.visits) {
    const b=study.blocks.find(b=>b.block===v.block);
    if(!b || !uuid.test(v.visitId) || ids.has(v.visitId) || v.runId!==(v.condition==='baseline'?b.baselineRunId:b.normalRunId) ||
      !['baseline','normal'].includes(v.condition) || !['home','catalog','product'].includes(v.page) ||
      v.route!==(v.page==='home'?'/':v.page==='catalog'?'/catalogo':v.route.match(/^\/productos\/[a-z0-9]+(?:-[a-z0-9]+)*$/)?.[0]) ||
      !Number.isInteger(v.repetition)||v.repetition<1||v.repetition>5||v.block!==(v.repetition<=2?1:v.repetition<=4?2:3)||
      !Number.isInteger(v.slot)||v.slot<1||v.slot>(v.block===3?3:6)||slots.has(v.runId+':'+v.slot))throw new Error('CWV_VISIT_PLAN_INVALID');
    slots.add(v.runId+':'+v.slot);if(v.page==='product')productRoutes.add(v.route);
    ids.add(v.visitId);const key=v.page+':'+v.condition,group=groups.get(key)||new Set<number>();
    if(group.has(v.repetition))throw new Error('CWV_DUPLICATE_REPETITION');group.add(v.repetition);groups.set(key,group);
  }
  if(groups.size!==6 || [...groups.values()].some(g=>g.size!==5)||productRoutes.size!==1)throw new Error('CWV_MATRIX_INVALID');
}
/** Reloj real de k6, no estimación desde la hora de spawn. Márgenes simétricos15s. */
export function cwvWindow(runId:string,condition:Condition,start:number): Window {
  if(!uuid.test(runId)||!Number.isFinite(start)||start<=0)throw new Error('CWV_CLOCK_INVALID');
  return {event:'cwv_window',runId,condition,startMs:start+(condition==='normal'?60000:0),
    endMs:start+(condition==='normal'?360000:300000),source:condition==='normal'?'k6-scenario':'baseline-clock',guardMs:15000};
}
export function validWindow(w:Window,runId:string,condition:Condition) {
  return w?.event==='cwv_window'&&w.runId===runId&&w.condition===condition&&w.source===(condition==='normal'?'k6-scenario':'baseline-clock')&&
    Number.isFinite(w.startMs)&&w.startMs>0&&w.endMs-w.startMs===300000&&w.guardMs===15000;
}
/** Debe haber muestras antes/después y cobertura continua de10VU, sin huecos>2,5s. */
export function tenVuCoverage(points:Gauge[],start:number,end:number) {
  const before=points.filter(p=>p.at<=start).at(-1),after=points.find(p=>p.at>=end);
  if(!before||!after||start-before.at>2500||after.at-end>2500)return false;
  const selected=points.filter(p=>p.at>=before.at&&p.at<=after.at);
  return selected.every((p,i)=>p.value===10&&Number.isFinite(p.at)&&(!i||p.at-selected[i-1].at<=2500));
}
const quantile=(values:number[],p:number)=>{if(!values.length)return null;const a=values.toSorted((a,b)=>a-b);return a[Math.max(0,Math.ceil(p*a.length)-1)];};
export function assessVisit(study:Study,visit:Visit,m:Measurement,w:Window,gauges:Gauge[]=[]) {
  const reasons:string[]=[];const start=Date.parse(m.startedAt),end=Date.parse(m.endedAt);
  if(m.visitId!==visit.visitId||m.source!=='manual-devtools')reasons.push('IDENTITY_OR_SOURCE_INVALID');
  if(m.observedUrl!==study.baseUrl+visit.route)reasons.push('DESTINATION_CHANGED');
  if(m.consoleErrors!==0||m.httpErrors!==0)reasons.push('BROWSER_ERRORS_OR_UNKNOWN');
  if(!sameControls(m.controls)||m.chromeVersion!==study.chromeVersion)reasons.push('CONTROLS_CHANGED');
  if(!m.foreground||!m.finalized)reasons.push('NOT_FOREGROUND_OR_NOT_FINAL');
  if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(m.startedAt)||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(m.endedAt)||!Number.isFinite(start)||!Number.isFinite(end)||end-start<20000||end-start>30000||!Number.isFinite(m.timeOriginMs)||Math.abs(m.timeOriginMs-start)>1000)reasons.push('DOCUMENT_OR_DURATION_INVALID');
  if(!validWindow(w,visit.runId,visit.condition)||start<w.startMs+w.guardMs||end>=w.endMs-w.guardMs)reasons.push('OUTSIDE_MEASUREMENT_WINDOW');
  if(visit.condition==='normal'&&!tenVuCoverage(gauges,start,end))reasons.push('TEN_VU_NOT_CONFIRMED');
  if(m.interactionCount!==(visit.page==='product'?4:3))reasons.push('INTERACTIONS_MISSING_OR_CHANGED');
  for(const [key,value,max] of [['LCP',m.lcpMs,3600000],['CLS',m.clsScore,100],['INP',m.inpMs,3600000]] as const)
    if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>max)reasons.push('MISSING_OR_INVALID_'+key);
  const clean=(v:unknown,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=max?v:null;
  return {visitId:visit.visitId,runId:visit.runId,block:visit.block,page:visit.page,route:visit.route,condition:visit.condition,
    repetition:visit.repetition,startedAt:Number.isFinite(start)?new Date(start).toISOString():null,endedAt:Number.isFinite(end)?new Date(end).toISOString():null,accepted:reasons.length===0,reasons,
    lcpMs:clean(m.lcpMs,3600000),clsScore:clean(m.clsScore,100),inpMs:clean(m.inpMs,3600000)};
}
export function cwvSummary(rows:ReturnType<typeof assessVisit>[]) {
  return ['home','catalog','product'].flatMap(page=>(['baseline','normal'] as const).flatMap(condition=>
    (['lcpMs','clsScore','inpMs'] as const).map(metric=>{
      const selected=rows.filter(r=>r.page===page&&r.condition===condition&&r.accepted);
      const values=selected.map(r=>r[metric]).filter((v):v is number=>typeof v==='number');
      return {page,condition,metric,unit:metric==='clsScore'?'score':'ms',n:values.length,planned:5,
        median:values.length?(()=>{const a=values.toSorted((a,b)=>a-b);return (a[Math.floor((a.length-1)/2)]+a[Math.floor(a.length/2)])/2;})():null,
        p75:quantile(values,0.75),min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null};
    })));
}
