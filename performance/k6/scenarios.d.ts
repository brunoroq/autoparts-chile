export type Stage = { duration: string; target: number };
export const profiles: Record<'baja' | 'normal' | 'pico', Stage[]>;
export const limits: Readonly<{ maxVus: number; maxSeconds: number; maxRequests: number }>;
export function durationSeconds(stages: Stage[]): number;
export function buildScenario(plan: import('./safety.js').PerformancePlan): Record<string, unknown>;
