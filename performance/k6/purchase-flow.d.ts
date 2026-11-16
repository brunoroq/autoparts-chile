import type { PurchasePlan } from './purchase-policy.js';
export type PurchaseAccount = { email: string; password?: string; sessionCookies?: { name: string; value: string }[] };
export type PurchaseTransport = (method: string, route: string, body?: Record<string, unknown>, headers?: Record<string, string>) => { status: number; json(): unknown };
export function purchaseFlow(transport: PurchaseTransport, plan: PurchasePlan, account: PurchaseAccount, key: string): { orderId: string; amountClp: number };
