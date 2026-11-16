import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { summarizePurchasePoints } from './purchase-analysis';
try {
  const [input, output, ...extra] = process.argv.slice(2);
  if (!input || !output || extra.length || path.resolve(input) === path.resolve(output)) throw new Error('ANALYSIS_ARGUMENTS');
  const analysis = summarizePurchasePoints(readFileSync(path.join(input, 'k6.jsonl'), 'utf8'));
  const summary = JSON.parse(readFileSync(path.join(input, 'summary.json'), 'utf8'));
  if (analysis.requests !== summary.metrics.http_reqs.values.count) throw new Error('ANALYSIS_COUNT_MISMATCH');
  const hashes = readdirSync(input).map(name => {
    const bytes = readFileSync(path.join(input, name));
    return { name, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') };
  });
  mkdirSync(output);
  writeFileSync(path.join(output, 'analysis.json'), JSON.stringify(analysis, null, 2), { flag: 'wx' });
  writeFileSync(path.join(output, 'originals-sha256.json'), JSON.stringify(hashes, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ output, requests: analysis.requests, originalsUnchanged: true }));
} catch { console.error('PURCHASE_ANALYSIS_STOPPED: no se sobrescriben originales ni resultados previos.'); process.exitCode = 1; }
