import { mkdirSync, readFileSync, writeFileSync, existsSync, statSync, createReadStream, realpathSync } from 'node:fs';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { createInterface } from 'node:readline';
import { fileURLToPath } from 'node:url';
import { createCwvStudy, validateStudy, uuid, assessVisit, cwvSummary, type Study, type Measurement, type Window, type Gauge } from './cwv-protocol';
import { csv } from './export-metrics';

const defaultRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
/** CLI offline; workspace inyectable solo como API para fixtures de pruebas. */
export async function runCwv(commandArgs:string[],root=defaultRoot) {
const args=[...commandArgs],action=args.shift();
const allowed=['--environment-id','--product-slug','--chrome-version','--study-id','--input'];
const value=(k:string)=>{const i=args.indexOf(k);return i<0?'':args[i+1];};
for(let i=0;i<args.length;i+=2)if(!allowed.includes(args[i])||!args[i+1]||args[i+1].startsWith('--'))throw new Error('CWV_ARGUMENT_INVALID');
const load=<T>(file:string)=>JSON.parse(readFileSync(file,'utf8')) as T;
const save=(file:string,data:unknown)=>writeFileSync(file,JSON.stringify(data,null,2),{flag:'wx',mode:0o600});
function studyPath(id:string){if(!uuid.test(id))throw new Error('CWV_STUDY_ID_INVALID');return path.join(root,'artifacts/cwv',id);}
function evidenceHash(dir:string,file:string,visitId:string,suffix:string) {
  if(file!==`evidence/${visitId}.${suffix}`)throw new Error('CWV_EVIDENCE_PATH_INVALID');
  const full=path.join(dir,...file.split('/'));
  if(!realpathSync(full).startsWith(realpathSync(dir)+path.sep)||!statSync(full).isFile()||statSync(full).size>100*1024*1024)throw new Error('CWV_EVIDENCE_FILE_INVALID');
  return createHash('sha256').update(readFileSync(full)).digest('hex');
}
async function gauges(file:string):Promise<Gauge[]> {
  const points:Gauge[]=[];
  if(!existsSync(file))return points;
  let count=0;
  for await(const line of createInterface({input:createReadStream(file),crlfDelay:Infinity})) {
    if(++count>1000000||line.length>100000)throw new Error('CWV_INPUT_LIMIT');
    try{const r=JSON.parse(line);if(r.type==='Point'&&r.metric==='vus'&&Number.isFinite(r.data?.value))points.push({at:Date.parse(r.data.time),value:r.data.value});}catch{/* Otras líneas no son cobertura de VU. */}
  }
  return points.sort((a,b)=>a.at-b.at);
}
async function main() {
  if(action==='plan') {
    if(value('--study-id')||value('--input'))throw new Error('CWV_PLAN_ARGUMENT_INVALID');
    const study=createCwvStudy(value('--environment-id'),value('--product-slug'),value('--chrome-version'));
    validateStudy(study);const dir=studyPath(study.studyId);mkdirSync(path.dirname(dir),{recursive:true});mkdirSync(dir,{recursive:false});mkdirSync(path.join(dir,'evidence'));
    save(path.join(dir,'study.json'),study);
    save(path.join(dir,'visits.template.json'),study.visits.map(v=>({visitId:v.visitId,startedAt:'',endedAt:'',timeOriginMs:null,
      chromeVersion:study.chromeVersion,controls:study.controls,foreground:false,finalized:false,interactionCount:0,source:'manual-devtools',
      observedUrl:study.baseUrl+v.route,consoleErrors:null,httpErrors:null,
      lcpMs:null,clsScore:null,inpMs:null,trace:`evidence/${v.visitId}.trace.json`,screenshot:`evidence/${v.visitId}.png`})));
    console.log(JSON.stringify({operation:'cwv-plan',studyId:study.studyId,visits:30,normalRuns:3,baselineRuns:3,baseUrl:study.baseUrl,output:dir,executedVisits:0,networkRequests:0}));return;
  }
  if(action!=='analyze'||value('--environment-id')||value('--product-slug')||value('--chrome-version'))throw new Error('CWV_USAGE_PLAN_OR_ANALYZE');
  const dir=studyPath(value('--study-id')),study=load<Study>(path.join(dir,'study.json'));validateStudy(study);
  const input=value('--input');if(!/^[a-zA-Z0-9_-]+\.json$/.test(input)||input==='study.json')throw new Error('CWV_INPUT_PATH_INVALID');
  const file=path.join(dir,input);if(!realpathSync(file).startsWith(realpathSync(dir)+path.sep)||statSync(file).size>1024*1024)throw new Error('CWV_INPUT_LIMIT');
  const measurements=load<Measurement[]>(file);if(!Array.isArray(measurements)||measurements.length>30)throw new Error('CWV_RECORDS_INVALID');
  const used=new Set<string>(),origins=new Set<number>(),traces=new Set<string>();
  const allowedFields=['visitId','startedAt','endedAt','timeOriginMs','chromeVersion','controls','foreground','finalized','interactionCount','source','observedUrl','consoleErrors','httpErrors','lcpMs','clsScore','inpMs','trace','screenshot'];
  for(const m of measurements){if(!m||typeof m!=='object'||Object.keys(m).some(k=>!allowedFields.includes(k))||!study.visits.some(v=>v.visitId===m.visitId)||used.has(m.visitId))throw new Error('CWV_RECORD_ID_OR_FIELDS_INVALID');used.add(m.visitId);}
  const runs=new Map<string,{window:Window;points:Gauge[];ok:boolean}>(),images=new Set<string>();
  for(const b of study.blocks)for(const runId of [b.baselineRunId,b.normalRunId]) {
    const run=path.join(root,'artifacts/performance',study.environmentId,'measurements',runId);
    if(!existsSync(path.join(run,'outcome.json'))||!existsSync(path.join(run,'cwv-window.json')))continue;
    const outcome=load<{exitCode:number;runError:boolean;observerFailed:boolean}>(path.join(run,'outcome.json'));
    const manifest=load<{cwv:{studyId:string;chromeVersion:string;serverImage:string;analytics:boolean;webVitals:boolean}}>(path.join(run,'manifest.json'));
    const integrity=load<{unchanged:boolean}>(path.join(run,'data-after.json'));
    if(manifest.cwv?.serverImage)images.add(manifest.cwv.serverImage);
    runs.set(runId,{window:load<Window>(path.join(run,'cwv-window.json')),points:await gauges(path.join(run,'k6.jsonl')),
      ok:outcome.exitCode===0&&!outcome.runError&&!outcome.observerFailed&&integrity.unchanged&&manifest.cwv?.analytics===false&&manifest.cwv.webVitals===true&&manifest.cwv.studyId===study.studyId&&manifest.cwv.chromeVersion===study.chromeVersion});
  }
  const rows=study.visits.map(v=>{
    const m=measurements.find(m=>m.visitId===v.visitId),r=runs.get(v.runId);
    const fallback={visitId:v.visitId,source:'manual-devtools',startedAt:'',endedAt:'',lcpMs:null,clsScore:null,inpMs:null} as Measurement;
    const row={...assessVisit(study,v,m||fallback,r?.window||{} as Window,r?.points||[]),traceSha256:null as string|null,screenshotSha256:null as string|null};
    if(!m)row.reasons.push('MISSING_VISIT_RECORD');
    if(!r?.ok)row.reasons.push('RUN_OR_INTEGRITY_NOT_CONFIRMED');
    if(images.size!==1)row.reasons.push('SERVER_IMAGE_NOT_CONSTANT');
    if(m){
      if(origins.has(m.timeOriginMs))row.reasons.push('REUSED_DOCUMENT');origins.add(m.timeOriginMs);
      try{const hash=evidenceHash(dir,m.trace,v.visitId,'trace.json');row.traceSha256=hash;row.screenshotSha256=evidenceHash(dir,m.screenshot,v.visitId,'png');if(traces.has(hash))row.reasons.push('REUSED_TRACE');traces.add(hash);}catch{row.reasons.push('EVIDENCE_MISSING_OR_INVALID');}
    }
    row.accepted=row.reasons.length===0;return row;
  });
  const output=path.join(dir,'analysis-'+randomUUID());mkdirSync(output,{recursive:false});
  const summary=cwvSummary(rows);
  save(path.join(output,'visits.json'),rows);save(path.join(output,'summary.json'),summary);
  save(path.join(output,'coverage.json'),{planned:30,accepted:rows.filter(r=>r.accepted).length,excluded:rows.filter(r=>!r.accepted).length,
    complete:rows.every(r=>r.accepted),source:'manual-devtools',physicalMeasurementsNotVerifiedByOfflineAnalyzer:true});
  writeFileSync(path.join(output,'visits.csv'),csv(rows),{flag:'wx'});writeFileSync(path.join(output,'summary.csv'),csv(summary),{flag:'wx'});
  const deltas=summary.filter(r=>r.condition==='normal').map(r=>{const base=summary.find(b=>b.page===r.page&&b.metric===r.metric&&b.condition==='baseline')!;
    return {page:r.page,metric:r.metric,unit:r.unit,baselineN:base.n,normalN:r.n,medianDelta:r.median!==null&&base.median!==null?r.median-base.median:null,
      medianDeltaPercent:r.median!==null&&base.median!==null&&base.median!==0?100*(r.median-base.median)/base.median:null};});
  writeFileSync(path.join(output,'deltas.csv'),csv(deltas),{flag:'wx'});
  console.log(JSON.stringify({operation:'cwv-analysis',studyId:study.studyId,planned:30,accepted:rows.filter(r=>r.accepted).length,excluded:rows.filter(r=>!r.accepted).length,complete:rows.every(r=>r.accepted),output}));
}
await main();
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  runCwv(process.argv.slice(2)).catch(()=>{console.error(JSON.stringify({operation:'cwv',code:'CWV_STOPPED',message:'Revisar plan, registros y evidencias locales; sin reparaciones o solicitudes automáticas.'}));process.exitCode=1;});
}
