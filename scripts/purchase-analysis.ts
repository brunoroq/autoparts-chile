import { PURCHASE_URL, allowedPurchaseRequest } from '../performance/k6/purchase-policy.js';
// Una etiqueta relativa no demuestra un destino de red observado.
export function purchaseRouteLabel(label: unknown) {
  if (typeof label !== 'string' || /[\\\r\n?#%]/.test(label) || label.startsWith('//')) throw new Error('PURCHASE_LABEL_INVALID');
  const absolute = /^https?:\/\//.test(label);
  const route = absolute ? (() => { const u = new URL(label); if (u.origin !== PURCHASE_URL || u.username || u.password) throw new Error('PURCHASE_LABEL_EXTERNAL'); return u.pathname; })() : label;
  const concrete = route.replaceAll('[id]', '12345678-1234-4234-8234-123456789abc');
  if (!allowedPurchaseRequest('GET', concrete) && !allowedPurchaseRequest('POST', concrete)) throw new Error('PURCHASE_LABEL_INVALID');
  return { route: route.replace(/\/[a-f0-9-]{36}/g, '/[id]'), destinationEvidence: absolute ? 'absolute_metric_label' : 'relative_label_only' };
}
export function summarizePurchasePoints(lines: string) {
  const statuses: Record<string, number> = {}, routes: Record<string, number> = {};
  const evidence = new Set<string>(); let requests = 0;
  for (const line of lines.trim().split(/\r?\n/).filter(Boolean)) {
    const row = JSON.parse(line);
    if (row.type !== 'Point' || row.metric !== 'http_req_duration') continue;
    const label = purchaseRouteLabel(row.data.tags.url);
    if (!allowedPurchaseRequest(row.data.tags.method, label.route.replaceAll('[id]', '12345678-1234-4234-8234-123456789abc'))) throw new Error('PURCHASE_METHOD_INVALID');
    requests++; evidence.add(label.destinationEvidence);
    const status = String(row.data.tags.status), name = row.data.tags.method + ' ' + label.route;
    statuses[status] = (statuses[status] || 0) + 1; routes[name] = (routes[name] || 0) + 1;
  }
  return { requests, statuses, routes, destinationEvidence: [...evidence], configuredOrigin: PURCHASE_URL };
}
