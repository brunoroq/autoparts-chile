import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { browserNetworkDecision, diagnosticTarget } from '../performance/k6/browser-policy.js';

// Reproducción del parser publicado de k6 v2.3.0, NO ejecución de k6/Chromium.
// Fuentes y líneas en docs/performance/chromium-startup-research.md.
const defaults = 'ImprovedCookieControls,LazyFrameLoading,GlobalMediaControls,DestroyProfileOnBrowserClose,MediaRouter,AcceptCHFrame';
function parse(value:string) {
  const flags:Record<string,string>={'disable-features':defaults};
  for(const token of value.split(',')) {
    const i=token.indexOf('=');
    const name=(i<0?token:token.slice(0,i)).trim();
    const val=i<0?'':token.slice(i+1).trim().replace(/^['"]|['"]$/g,'');
    flags[name]=val;
  }
  return flags;
}
test('k6 v2.3.0: una lista de features entrecomillada se fragmenta antes de interpretar flags', () => {
  const wrong=parse('disable-features="'+defaults+',NetworkTimeServiceQuerying"');
  assert.equal(wrong['disable-features'],'ImprovedCookieControls');
  assert.notEqual(wrong['disable-features'],defaults+',NetworkTimeServiceQuerying');
  assert.ok(Object.keys(wrong).some(key=>key.includes('NetworkTimeServiceQuerying')));
});
test('k6 v2.3.0: flags repetidas reemplazan valores y no acumulan features', () => {
  const wrong=parse('disable-features=MediaRouter,disable-features=NetworkTimeServiceQuerying');
  assert.equal(wrong['disable-features'],'NetworkTimeServiceQuerying');
  assert.equal(wrong['disable-features'].includes('MediaRouter'),false);
});
test('el candidato no se aplica: arranque conserva proxy exacto y denegación de tráfico auxiliar/oficial', () => {
  const runner=readFileSync('scripts/run-performance-observer.ts','utf8');
  assert.ok(runner.includes('const args = `proxy-server=http://127.0.0.1:${proxy.port},proxy-bypass-list=<-loopback>`;'));
  assert.doesNotMatch(runner,/disable-features=NetworkTimeServiceQuerying|ignore-certificate-errors|no-sandbox/);
  const id='G-BLNW54CZ2R';
  assert.equal(diagnosticTarget('http://clients2.google.com/time/1/current'),'chrome_auxiliary');
  assert.equal(browserNetworkDecision('GET','http://clients2.google.com/time/1/current',null,id).allowed,false);
  assert.equal(browserNetworkDecision('GET','https://www.googletagmanager.com/gtag/js?id=G-VVKYV486NP',null,id).allowed,false);
});
