import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { PURCHASE_URL, validatePurchasePlan, type PurchasePlan } from '../performance/k6/purchase-policy.js';
import { preflightPurchase } from './purchase-preflight';
import { purchaseSessions } from './purchase-auth';
import { summarizePurchasePoints } from './purchase-analysis';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
async function main() {
  const [action, ...args] = process.argv.slice(2);
  const flags = new Map<string, string>();
  const values = ['--environment-id', '--vus', '--purchases', '--requests', '--seconds', '--plan-file'];
  for (let i = 0; i < args.length; i++) {
    const flag = args[i];
    if (flags.has(flag) || ![...values, '--execute', '--accept-test-writes'].includes(flag)) throw new Error('PURCHASE_ARGUMENT_REJECTED');
    flags.set(flag, values.includes(flag) ? args[++i] : 'true');
    if (!flags.get(flag) || flags.get(flag)!.startsWith('--')) throw new Error('PURCHASE_ARGUMENT_REJECTED');
  }
  if (action === 'plan') {
    if (flags.has('--execute') || flags.has('--accept-test-writes') || flags.has('--plan-file')) throw new Error('PURCHASE_ARGUMENT_REJECTED');
    const now = Date.now(), seconds = Number(flags.get('--seconds') || 90);
    const plan = validatePurchasePlan({ workload: 'purchase', baseUrl: PURCHASE_URL,
      runId: randomUUID(), environmentId: flags.get('--environment-id') || '', paymentProvider: 'SIMULATED', analytics: false,
      vus: Number(flags.get('--vus') || 1), maxPurchases: Number(flags.get('--purchases') || 1),
      maxRequests: Number(flags.get('--requests') || 100), seconds, createdAt: now, deadline: now + seconds * 1000 });
    console.log(JSON.stringify({ dryRun: true, plan }));
    return;
  }
  if (action === 'preflight' && flags.size === 1 && flags.has('--environment-id')) {
    console.log(JSON.stringify(await preflightPurchase(flags.get('--environment-id')!))); return;
  }
  if (action !== 'run' || flags.get('--execute') !== 'true' || flags.get('--accept-test-writes') !== 'true' || flags.size !== 3 || !flags.has('--plan-file')) throw new Error('PURCHASE_EXECUTION_NOT_AUTHORIZED');
  const planPath = realpathSync(path.resolve(root, flags.get('--plan-file')!));
  if (!planPath.startsWith(path.join(root, 'artifacts', 'purchase') + path.sep)) throw new Error('PURCHASE_PLAN_PATH_REJECTED');
  const plan: PurchasePlan = validatePurchasePlan(JSON.parse(readFileSync(planPath, 'utf8')));
  await preflightPurchase(plan.environmentId);
  // Cuentas futuras por stdin: únicamente memoria; nunca argv, archivos o logs.
  const input = readFileSync(0, 'utf8');
  if (input.length > 32768) throw new Error('PURCHASE_ACCOUNTS_INVALID');
  const accounts = JSON.parse(input);
  if (!Array.isArray(accounts) || accounts.length !== plan.vus || new Set(accounts.map(a => a.email)).size !== plan.vus || accounts.some(a => typeof a.email !== 'string' || typeof a.password !== 'string' || a.password.length < 12)) throw new Error('PURCHASE_ACCOUNTS_INVALID');
  validatePurchasePlan(plan);
  const output = path.join(root, 'artifacts', 'purchase-results', plan.runId);
  mkdirSync(path.dirname(output), { recursive: true }); mkdirSync(output);
  writeFileSync(path.join(output, 'plan.json'), JSON.stringify(plan, null, 2), { flag: 'wx' });
  const authStart = Date.now();
  const prepared = await purchaseSessions(accounts, plan);
  const authDurationMs = Date.now() - authStart;
  const childEnv: NodeJS.ProcessEnv = { NODE_ENV: 'production' };
  for (const key of ['PATH', 'Path', 'SYSTEMROOT', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE']) if (process.env[key]) childEnv[key] = process.env[key];
  Object.assign(childEnv, { PURCHASE_PLAN: planPath, PURCHASE_ACCOUNTS: JSON.stringify(prepared.sessions), PURCHASE_RUNNER_READY: 'local-inspection-passed' });
  const binary = process.env.K6_BIN || (process.platform === 'win32' ? 'C:/Program Files/k6/k6.exe' : 'k6');
  const child = spawn(binary, ['run', '--quiet', '--out', 'json=' + path.join(output, 'k6.jsonl'), '--out', 'csv=' + path.join(output, 'k6.csv'), 'performance/k6/purchase-journey.js'], { cwd: root, env: childEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  let summary = '';
  child.stdout.on('data', b => { if (summary.length < 1024 * 1024) summary += String(b); });
  child.stderr.resume();
  let stopped = false;
  const stop = () => { stopped = true; child.kill(); };
  const watchdog = setTimeout(stop, Math.max(1, plan.deadline - Date.now()));
  const memory = setInterval(() => { if (os.freemem() < 2 * 1024 ** 3) stop(); }, 1000);
  const interrupt = () => stop();
  process.once('SIGINT', interrupt); process.once('SIGTERM', interrupt);
  try {
    const code = await new Promise<number | null>(resolve => { child.once('close', resolve); child.once('error', () => resolve(null)); });
    try {
      const line = summary.split(/\r?\n/).find(l => l.startsWith('{"experiment":'));
      const parsed = JSON.parse(line || 'null');
      if (parsed.experiment === plan.runId && parsed.workload === 'purchase') writeFileSync(path.join(output, 'summary.json'), JSON.stringify(parsed, null, 2), { flag: 'wx' });
    } catch { /* No guardar salida bruta: puede incluir mensajes de bibliotecas. */ }
    let analysisValid = false;
    try { writeFileSync(path.join(output, 'analysis.json'), JSON.stringify(summarizePurchasePoints(readFileSync(path.join(output, 'k6.jsonl'), 'utf8')), null, 2), { flag: 'wx' }); analysisValid = true; } catch { /* No reenviar solicitudes si falla un an?lisis. */ }
    writeFileSync(path.join(output, 'outcome.json'), JSON.stringify({ code, stopped, experiment: plan.runId, setupRequests: prepared.requests, authDurationMs, analysisValid, endedAt: new Date().toISOString() }), { flag: 'wx' });
    console.log(JSON.stringify({ experiment: plan.runId, output, code, stopped }));
    if (code !== 0 || stopped) process.exitCode = 1;
  } finally { clearTimeout(watchdog); clearInterval(memory); process.removeListener('SIGINT', interrupt); process.removeListener('SIGTERM', interrupt); }
}
main().catch(() => { console.error('PURCHASE_STOPPED_SAFE: revisar plan, aislamiento y autorizaciones; sin reintento.'); process.exitCode = 1; });
