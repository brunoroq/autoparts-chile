import type { PerformancePlan } from './safety.js';
export function summaryFiles(data: { metrics: Record<string, { values: Record<string, number> }> }, plan: PerformancePlan): Record<string, string>;
