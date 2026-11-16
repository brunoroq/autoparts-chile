import { purchaseIsolation } from '../src/lib/observability/purchase-isolation';
export type PurchaseContainer = {
  Name: string; State: { Running: boolean; Health?: { Status: string } };
  Config: { Env: string[]; Labels: Record<string, string> };
  NetworkSettings: { Ports: Record<string, { HostIp: string; HostPort: string }[] | null>; Networks: Record<string, unknown> };
};
export function validatePurchaseContainers(containers: PurchaseContainer[], environmentId: string) {
  const app = containers.find(c => c.Name === '/autoparts-purchase-app');
  const pg = containers.find(c => c.Name === '/autoparts-purchase-postgres');
  if (!app || !pg || containers.length !== 2) throw new Error('PURCHASE_CONTAINERS_INVALID');
  for (const c of [app, pg]) {
    if (!c.State.Running || c.State.Health?.Status !== 'healthy' || c.Config.Labels['autoparts.scope'] !== 'purchase-test' ||
        Object.keys(c.NetworkSettings.Networks).some(n => !['autoparts-purchase_lab', 'autoparts-purchase_ingress'].includes(n))) throw new Error('PURCHASE_CONTAINERS_INVALID');
  }
  if (!app.NetworkSettings.Networks['autoparts-purchase_lab'] || !pg.NetworkSettings.Networks['autoparts-purchase_lab'] ||
      pg.NetworkSettings.Networks['autoparts-purchase_ingress'] || Object.values(pg.NetworkSettings.Ports).some(Boolean)) throw new Error('PURCHASE_NETWORK_INVALID');
  const published = Object.values(app.NetworkSettings.Ports).flatMap(p => p || []);
  if (published.length !== 1 || published[0].HostIp !== '127.0.0.1' || published[0].HostPort !== '3102') throw new Error('PURCHASE_PORT_INVALID');
  const env = Object.fromEntries(app.Config.Env.map(value => { const at = value.indexOf('='); return [value.slice(0, at), value.slice(at + 1)]; }));
  if (!pg.Config.Env.includes('POSTGRES_DB=autoparts_purchase_test')) throw new Error('PURCHASE_DATABASE_INVALID');
  const marker = purchaseIsolation(env);
  if (!marker || marker.runId !== environmentId) throw new Error('PURCHASE_ENVIRONMENT_INVALID');
  return marker;
}
