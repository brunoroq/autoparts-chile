import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'dotenv';
import { purchaseAccount } from './purchase-accounts';
import { PURCHASE_URL, validatePurchasePlan } from '../performance/k6/purchase-policy.js';

async function main() {
  const args = process.argv.slice(2);
  const concurrent = args.length === 6 && args[4] === '--vus' && args[5] === '10';
  if ((!concurrent && args.length !== 4) || args[0] !== '--env-file' || args[2] !== '--execute' || args[3] !== '--accept-test-writes') throw new Error('PURCHASE_CONSENT_REQUIRED');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const file = realpathSync(path.resolve(root, args[1]));
  if (!file.startsWith(path.join(root, 'artifacts', 'purchase-lab') + path.sep) || path.basename(file) !== 'compose.env') throw new Error('PURCHASE_PRIVATE_FILE_REJECTED');
  const env = parse(readFileSync(file));
  const vus = concurrent ? 10 : 1;
  const now = Date.now();
  const plan = validatePurchasePlan({ workload: 'purchase', baseUrl: PURCHASE_URL, runId: randomUUID(), environmentId: env.PURCHASE_ENVIRONMENT_ID,
    paymentProvider: 'SIMULATED', analytics: false, vus, maxPurchases: vus, maxRequests: concurrent ? 500 : 100, seconds: 90, createdAt: now, deadline: now + 90000 });
  const accounts = Array.from({ length: vus }, (_, i) => purchaseAccount(plan.environmentId, env.PURCHASE_AUTH_SECRET, i + 1));
  const dir = path.join(root, 'artifacts', 'purchase'); mkdirSync(dir, { recursive: true });
  const planFile = path.join(dir, plan.runId + '.json');
  writeFileSync(planFile, JSON.stringify(plan), { flag: 'wx' });
  const result = spawnSync(process.execPath, ['--import', 'tsx', 'scripts/run-purchase-performance.ts', 'run', '--plan-file', planFile, '--execute', '--accept-test-writes'], {
    cwd: root, input: JSON.stringify(accounts), stdio: ['pipe', 'inherit', 'inherit'],
  });
  process.exitCode = result.status ?? 1;
}
main().catch(() => { console.error('PURCHASE_ONCE_STOPPED_SAFE: revisar autorización y laboratorio; sin reintentos.'); process.exitCode = 1; });
