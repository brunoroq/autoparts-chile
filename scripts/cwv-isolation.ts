import type { Container, DockerCall } from './performance-observer-container';
import { containerEnv } from './performance-observer-container';
import { uuid } from './cwv-protocol';

/** Solo acepta los servicios locales existentes; inspección completa permanece en memoria. */
export function validateCwvContainers(all:Container[],environmentId:string) {
  const app=all.find(c=>c.Name==='/autoparts-performance-app-1'),pg=all.find(c=>c.Name==='/autoparts-performance-postgres-1');
  if(!uuid.test(environmentId)||!app||!pg)throw new Error('CWV_SOURCE_INVALID');
  for(const c of [app,pg])if(!c.State.Running||c.State.Health?.Status!=='healthy'||c.State.OOMKilled||c.RestartCount||c.Config.Labels['com.docker.compose.project']!=='autoparts-performance')throw new Error('CWV_HEALTH_INVALID');
  const env=containerEnv(app),pgEnv=containerEnv(pg),db=new URL(env.DATABASE_URL||'');
  if(env.ANALYTICS_ENABLED!=='false'||env.GA4_MEASUREMENT_ID||env.GA4_SYNTHETIC_MEASUREMENT_ID||env.PERF_BROWSER_ANALYTICS==='true'||
    env.VERCEL||env.PERF_ISOLATED!=='true'||env.APP_ENV!=='performance-local'||env.TRAFFIC_KIND!=='synthetic'||env.CATALOG_SIZE!=='30'||env.PAYMENT_PROVIDER!=='simulated'||
    env.NEXTAUTH_URL!=='http://127.0.0.1:3100'||db.protocol!=='postgresql:'||db.hostname!=='postgres'||db.port!=='5432'||db.pathname!=='/autoparts_performance_test'||db.search||db.hash||env.DIRECT_URL!==env.DATABASE_URL||
    JSON.stringify(app.HostConfig.PortBindings)!==JSON.stringify({'3000/tcp':[{HostIp:'127.0.0.1',HostPort:'3100'}]})||
    JSON.stringify(app.NetworkSettings.Ports?.['3000/tcp'])!==JSON.stringify([{HostIp:'127.0.0.1',HostPort:'3100'}])||
    pgEnv.POSTGRES_DB!=='autoparts_performance_test'||pgEnv.POSTGRES_USER!=='performance'||
    Object.keys(pg.HostConfig.PortBindings||{}).length||Object.values(pg.NetworkSettings.Ports||{}).some(p=>p?.length)||
    pg.Mounts.length!==1||pg.Mounts[0].Type!=='volume'||pg.Mounts[0].Name!==`autoparts-performance-${environmentId}`)throw new Error('CWV_ISOLATION_INVALID');
  const networks=Object.keys(pg.NetworkSettings.Networks);
  if(networks.length!==1||!Object.hasOwn(app.NetworkSettings.Networks,networks[0]))throw new Error('CWV_NETWORK_INVALID');
  return {app,pg,privateNetwork:networks[0]};
}
/** SELECT forzado a solo lectura; hashes de filas, nunca contenido de usuarios. */
export function cwvFingerprint(call:DockerCall,pgId:string) {
  if(!/^[a-f0-9]{64}$/.test(pgId))throw new Error('CWV_PG_ID_INVALID');
  const names=['Product','Category','User','Cart','CartItem','Order','OrderItem','PaymentAttempt','CartMergeReceipt'];
  const parts=names.map(n=>`'${n}',(SELECT json_build_object('count',count(*),'hash',md5(COALESCE(string_agg(row_to_json(t)::text,E'\\n' ORDER BY t.id),''))) FROM "${n}" t)`);
  return JSON.parse(call(['exec','-e','PGOPTIONS=-c default_transaction_read_only=on',pgId,'psql','-U','performance','-d','autoparts_performance_test','-X','-A','-t','-v','ON_ERROR_STOP=1','-c',`SELECT json_build_object(${parts.join(',')});`])) as Record<string,{count:number;hash:string}>;
}
