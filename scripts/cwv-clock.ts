import { cwvWindow, type Window } from './cwv-protocol';

/** Solo JSON conocido; jamás persistir stdout/stderr crudos o URLs. */
export function cwvClockReader(runId:string,createdAt:number,sink:(w:Window)=>void) {
  let buffer='',seen=false;
  return (chunk:unknown)=>{
    buffer+=String(chunk);let i:number;
    while((i=buffer.indexOf('\n'))>=0){const line=buffer.slice(0,i);buffer=buffer.slice(i+1);if(line.length>65536)continue;
      try{const outer=JSON.parse(line),v=typeof outer.msg==='string'?JSON.parse(outer.msg):outer;
        if(seen||v.event!=='cwv_scenario_clock'||v.runId!==runId||!Number.isFinite(v.startMs)||v.startMs<createdAt||v.startMs>createdAt+30000)continue;
        seen=true;sink(cwvWindow(runId,'normal',v.startMs));
      }catch{/* Descartar texto libre; el cierre sin reloj se considera fallo. */}
    }
    if(buffer.length>65536)buffer='';
  };
}
