import type { BrowserPlan } from './browser-policy.js';
// Contrato estructural mínimo; las implementaciones son k6/browser y el adaptador offline.
export function browserFlow(page: unknown, plan: BrowserPlan, onStep?: (step: string) => void, waitForEvent?: (event: string, count: number) => Promise<void>, diagnose?: (code:string, fields?:Record<string,unknown>) => void): Promise<{productId: string; unitPriceClp: number; quantity: number; events: string[]; evidence: string; consent: 'granted'; javascript: true; steps: string[]}>;
export function browserInit(config: {measurementId: string}): void;
