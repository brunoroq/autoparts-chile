import type { BrowserPlan } from './browser-policy.js';
// Contrato estructural mínimo; las implementaciones son k6/browser y el adaptador offline.
export function browserFlow(page: unknown, plan: BrowserPlan): Promise<{productId: string; unitPriceClp: number; quantity: number; events: string[]; evidence: string}>;
export function browserInit(config: {measurementId: string}): void;
