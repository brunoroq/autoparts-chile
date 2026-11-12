export const BASE_URL: string;
export type PerformancePlan = { runId: string; baseUrl: string; profile: 'baja' | 'normal' | 'pico'; model: 'closed' | 'arrival'; peakRate: number; catalogSize: number; maxVus: number; maxRequests: number; createdAt: number; deadline: number; output: string };
export function validatePlan(plan: PerformancePlan, now?: number): PerformancePlan;
export function allowedRequest(method: string, route: string): boolean;
export function requestBudget(maxRequests: number, maxVus: number, vuId: number): number;
