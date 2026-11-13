import { BASE_URL } from '../performance/k6/safety.js';

/** Solo imágenes públicas optimizadas del HTML local; nunca URLs remotas incrustadas. */
export function cwvImagePaths(html:string) {
  if(html.length>2*1024*1024)throw new Error('CWV_HTML_LIMIT');
  const paths=new Set<string>();
  for(const m of html.replaceAll('&amp;','&').matchAll(/\/_next\/image\?[^"'<>\s\\]+/g)) {
    const u=new URL(m[0],BASE_URL),image=u.searchParams.get('url')||'';
    if(/^\/images\/[a-zA-Z0-9_./-]+$/.test(image)&&!image.includes('..')&&/^\d+$/.test(u.searchParams.get('w')||'')&&/^\d+$/.test(u.searchParams.get('q')||''))paths.add(u.pathname+u.search);
  }
  if(paths.size>96)throw new Error('CWV_IMAGE_LIMIT');return [...paths];
}
/** Calentamiento GET secuencial antes del reloj medido, sin JS/gtag ni compras. */
export async function warmCwvPages(productRoute:string,request:typeof fetch=fetch) {
  if(!/^\/productos\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(productRoute))throw new Error('CWV_WARMUP_ROUTE_INVALID');
  const images=new Set<string>();let count=0,total=0;
  const read=async(route:string,text:boolean)=>{
    if(++count>99)throw new Error('CWV_WARMUP_LIMIT');
    const r=await request(BASE_URL+route,{redirect:'error',signal:AbortSignal.timeout(15000),cache:'no-store'});
    if(!r.ok||r.redirected)throw new Error('CWV_WARMUP_HTTP_FAILED');
    const chunks:Uint8Array[]=[];const reader=r.body?.getReader();let size=0;
    if(reader)for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;total+=part.value.byteLength;
      if(total>64*1024*1024||size>(text?2:10)*1024*1024){await reader.cancel();throw new Error('CWV_WARMUP_BYTES_LIMIT');}if(text)chunks.push(part.value);}
    return text?Buffer.concat(chunks).toString('utf8'):'';
  };
  for(const route of ['/','/catalogo',productRoute])for(const image of cwvImagePaths(await read(route,true)))images.add(image);
  if(images.size>96)throw new Error('CWV_IMAGE_LIMIT');
  for(const image of images)await read(image,false);
  return {requests:count,bytes:total,imageVariants:images.size,mode:'sequential-local-get-before-window'};
}
