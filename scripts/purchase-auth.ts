import { PURCHASE_URL, validatePurchaseMarker, validatePurchasePlan, type PurchasePlan } from '../performance/k6/purchase-policy.js';
export async function purchaseSessions(accounts: { email: string; password: string }[], plan: PurchasePlan, transport: typeof fetch = fetch) {
  const sessions = []; const owners = new Set<string>(); let requests = 0;
  for (const account of accounts) {
    const jar = new Map<string, string>();
    const call = async (route: string, body?: URLSearchParams) => {
      validatePurchasePlan(plan);
      if (++requests > plan.vus * 4) throw new Error('PURCHASE_AUTH_BUDGET');
      const response = await transport(PURCHASE_URL + route, { method: body ? 'POST' : 'GET', body,
        headers: { Origin: PURCHASE_URL, Cookie: [...jar].map(([k, v]) => k + '=' + v).join('; ') },
        redirect: 'error', signal: AbortSignal.timeout(Math.max(1, Math.min(5000, plan.deadline - Date.now()))) });
      if (response.status !== 200) throw new Error('PURCHASE_AUTH_FAILED');
      for (const cookie of response.headers.getSetCookie()) { const pair = cookie.split(';')[0], at = pair.indexOf('='); jar.set(pair.slice(0, at), pair.slice(at + 1)); }
      return response.json();
    };
    const csrf = await call('/api/auth/csrf');
    validatePurchaseMarker(await call('/api/performance/status'), plan);
    await call('/api/auth/callback/credentials', new URLSearchParams({ csrfToken: csrf.csrfToken, email: account.email, password: account.password, callbackUrl: '/carrito', json: 'true' }));
    const session = await call('/api/auth/session');
    if (!session.user?.id || session.user.email !== account.email || owners.has(session.user.id) || !jar.size) throw new Error('PURCHASE_AUTH_FAILED');
    owners.add(session.user.id);
    sessions.push({ email: account.email, sessionCookies: [...jar].map(([name, value]) => ({ name, value })) });
  }
  return { sessions, requests };
}
