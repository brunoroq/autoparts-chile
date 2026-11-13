import { BrowserDiagnostics, browserErrorCode } from '../performance/k6/browser-diagnostics.js';

/** Descartar texto crudo de k6; conservar solo registros de esquema cerrado. */
export function diagnosticStream(diagnostics: BrowserDiagnostics) {
  let pending = '';
  const line = (value: string) => {
    try {
      const outer = JSON.parse(value);
      const row = typeof outer.msg === 'string' ? JSON.parse(outer.msg) : outer;
      if (row?.event === 'observer_diagnostic') { diagnostics.record(row.code, {...row, source:'browser'}); return; }
    } catch { /* Mensajes no estructurados nunca se escriben en disco. */ }
    if (/"level"\s*:\s*"error"/.test(value)) diagnostics.record('K6_RUNTIME_ERROR', {source:'runner', reason:browserErrorCode(value), fatal:true});
  };
  return {
    consume(chunk: unknown) {
      pending += String(chunk);
      let i: number;
      while ((i = pending.indexOf('\n')) >= 0) { const current = pending.slice(0,i); pending = pending.slice(i+1); if (current.length <= 65536) line(current); }
      if (pending.length > 65536) { pending = ''; diagnostics.record('DIAGNOSTIC_INPUT_DROPPED'); }
    },
    flush() { if (pending) line(pending); pending = ''; },
  };
}
