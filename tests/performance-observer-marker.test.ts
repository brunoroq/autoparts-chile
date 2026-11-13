import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateOriginalObserverMarker } from '../scripts/performance-observer-marker.js';

const id = '22672790-ca60-4917-aa80-6c8522ac2448';
const marker = {isolated:true, runId:id, catalogSize:30};
const env = {ANALYTICS_ENABLED:'false', GA4_MEASUREMENT_ID:'', GA4_SYNTHETIC_MEASUREMENT_ID:''};
test('marcador antiguo válido no requiere analytics y exige configuración independiente', () => {
  assert.deepEqual(validateOriginalObserverMarker(marker,id,30,env),marker);
  assert.deepEqual(validateOriginalObserverMarker(marker,id,30,{ANALYTICS_ENABLED:'false'}),marker);
  assert.deepEqual(validateOriginalObserverMarker({...marker,analytics:false,measurementId:'',observer:false,origin:'http://127.0.0.1:3100'},id,30,env),marker);
});
test('marcadores inválidos o contradictorios se rechazan sin exponer datos', () => {
  for (const value of [null,[],{}, {...marker,isolated:false}, {...marker,runId:'12345678-1234-1234-1234-123456789abc'},
    {...marker,catalogSize:'30'}, {...marker,catalogSize:1000}, {...marker,analytics:true}, {...marker,analytics:null},
    {...marker,measurementId:'G-VVKYV486NP'}, {...marker,observer:true}, {...marker,origin:'http://127.0.0.1:3101'}]) {
    assert.throws(()=>validateOriginalObserverMarker(value,id,30,env),/^Error: ORIGINAL_MARKER_INVALID$/);
  }
  assert.throws(()=>validateOriginalObserverMarker({...marker,runId:'invalid'},'invalid',30,env),/ORIGINAL_MARKER_INVALID/);
  assert.throws(()=>validateOriginalObserverMarker({...marker,catalogSize:31},id,31,env),/ORIGINAL_MARKER_INVALID/);
});
test('Analytics activado o IDs configurados en el original bloquean incluso el marcador antiguo', () => {
  for (const config of [{...env,ANALYTICS_ENABLED:'true'},{...env,ANALYTICS_ENABLED:undefined},
    {...env,GA4_MEASUREMENT_ID:'G-VVKYV486NP'},{...env,GA4_MEASUREMENT_ID:'G-BLNW54CZ2R'},
    {...env,GA4_SYNTHETIC_MEASUREMENT_ID:'G-BLNW54CZ2R'}, {...env,GA4_MEASUREMENT_ID:' '}]) {
    assert.throws(()=>validateOriginalObserverMarker(marker,id,30,config),/^Error: ORIGINAL_ANALYTICS_CONFIG_INVALID$/);
  }
});
test('compatibilidad antigua se limita al preflight original; temporal conserva su marcador estricto', () => {
  const runner=readFileSync('scripts/run-performance-observer.ts','utf8');
  assert.doesNotMatch(runner,/validateOriginalObserverMarker/);
  assert.match(runner,/marker\.analytics !== true/);
  assert.match(runner,/marker\.measurementId !== input\.measurementId/);
  assert.match(runner,/marker\.observer !== true/);
});
