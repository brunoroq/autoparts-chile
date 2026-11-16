export type PurchasePlan = { workload: 'purchase'; baseUrl: string; runId: string; environmentId: string; paymentProvider: 'SIMULATED'; analytics: false; vus: number; maxPurchases: number; maxRequests: number; seconds: number; createdAt: number; deadline: number };
export const PURCHASE_URL: string;
export const purchaseLimits: Readonly<{ vus: number; purchases: number; requests: number; seconds: number }>;
export function validatePurchasePlan(plan: PurchasePlan, now?: number): PurchasePlan;
export function validatePurchaseMarker(marker: unknown, plan: Pick<PurchasePlan, "environmentId">): void;
export function allowedPurchaseRequest(method: string, route: string): boolean;
export function purchaseBudget(plan: PurchasePlan, vu: number): number;
