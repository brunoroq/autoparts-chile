export const BROWSER_LIMITS: Readonly<{requests: number; tunnels: number; bytes: number}>;
export const BROWSER_BASE_URL: string;
export function googleHost(host: string): boolean;
export function browserRequestAllowed(method: string, rawUrl: string): boolean;
export function browserNetworkAllowed(method: string, rawUrl: string, body: string | null, measurementId: string): boolean;
export function browserNetworkDecision(method: string, rawUrl: string, body: string | null, measurementId: string): {allowed:boolean; reason:string};
export function diagnosticTarget(rawUrl: string): string;
export type BrowserPlan = {baseUrl: string; measurementId: string; proxyPort: number; runId: string; catalogSize: number; delaySeconds: number; createdAt: number; deadline: number};
export function validateBrowserPlan(plan: BrowserPlan, now?: number): BrowserPlan;
