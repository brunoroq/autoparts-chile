import { execFileSync } from 'node:child_process';
import path from 'node:path';
import os from 'node:os';
import { validatePurchaseContainers } from './purchase-environment';
import { PURCHASE_URL, validatePurchaseMarker } from '../performance/k6/purchase-policy.js';
export async function preflightPurchase(environmentId: string) {
  if (!/^[a-f0-9-]{36}$/.test(environmentId) || os.freemem() < 2 * 1024 ** 3) throw new Error('PURCHASE_PREFLIGHT_BLOCKED');
  const docker = process.env.DOCKER_BIN || (process.platform === 'win32' ? path.join(process.env.LOCALAPPDATA || '', 'Programs/DockerDesktop/resources/bin/docker.exe') : 'docker');
  const containers = JSON.parse(execFileSync(docker, ['inspect', 'autoparts-purchase-app', 'autoparts-purchase-postgres'], { encoding: 'utf8', timeout: 10000 }));
  validatePurchaseContainers(containers, environmentId);
  const networks = JSON.parse(execFileSync(docker, ['network', 'inspect', 'autoparts-purchase_lab', 'autoparts-purchase_ingress'], { encoding: 'utf8', timeout: 10000 }));
  const lab = networks.find((n: { Name: string }) => n.Name === 'autoparts-purchase_lab');
  const ingress = networks.find((n: { Name: string }) => n.Name === 'autoparts-purchase_ingress');
  if (networks.length !== 2 || !lab?.Internal || ingress?.Options?.['com.docker.network.bridge.enable_ip_masquerade'] !== 'false' ||
      Object.keys(lab.Containers || {}).length !== 2 || Object.keys(ingress.Containers || {}).length !== 1) throw new Error('PURCHASE_NETWORK_INVALID');
  const response = await fetch(PURCHASE_URL + '/api/performance/status', { redirect: 'error', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('PURCHASE_ENDPOINT_UNREACHABLE');
  const marker = await response.json();
  validatePurchaseMarker(marker, { environmentId });
  return { ready: true, marker, freeMemoryGiB: Number((os.freemem() / 1024 ** 3).toFixed(2)) };
}
