import { profiles, durationSeconds, limits } from './scenarios.js';

// El destino es literal: no se resuelven nombres ni se admiten URLs arbitrarias.
export const BASE_URL = 'http://127.0.0.1:3100';
export function validatePlan(plan, now = Date.now()) {
  if (!plan || plan.baseUrl !== BASE_URL || !Object.hasOwn(profiles, plan.profile) ||
      !['closed', 'arrival'].includes(plan.model) || !Number.isInteger(plan.peakRate) || plan.peakRate < 1 || plan.peakRate > 5 ||
      !/^[a-f0-9-]{36}$/.test(plan.runId) || ![30, 1000, 10000].includes(plan.catalogSize) ||
      !Number.isInteger(plan.maxVus) || plan.maxVus < 1 || plan.maxVus > limits.maxVus ||
      !Number.isInteger(plan.maxRequests) || plan.maxRequests < plan.maxVus || plan.maxRequests > limits.maxRequests ||
      !Number.isFinite(plan.deadline) || !Number.isFinite(plan.createdAt) || plan.createdAt > now ||
      now >= plan.deadline || plan.deadline - plan.createdAt > limits.maxSeconds * 1000 ||
      plan.deadline - plan.createdAt < (durationSeconds(profiles[plan.profile]) + 30) * 1000 ||
      Math.max(...profiles[plan.profile].map(s => s.target)) > plan.maxVus) {
    throw new Error('Plan ausente, vencido o fuera de límites; usar npm run perf -- plan|run.');
  }
  return plan;
}
export function allowedRequest(method, route) {
  if (typeof route !== 'string' || !route.startsWith('/') || route.startsWith('//') || /[\\#\r\n]/.test(route)) return false;
  if (method === 'POST') return route === '/api/v1/cart/guest';
  if (method !== 'GET') return false;
  const pathname = route.split('?')[0];
  return ['/', '/catalogo', '/api/v1/products', '/api/v1/categories', '/api/performance/status'].includes(pathname) ||
    /^\/productos\/[a-z0-9-]+$/.test(pathname) || /^\/api\/v1\/products\/[a-f0-9-]{36}$/.test(pathname);
}
// Partición por VU: aun sin contador global compartido, la suma nunca supera el tope.
export function requestBudget(maxRequests, maxVus, vuId) {
  if (!Number.isInteger(vuId) || vuId < 1 || vuId > maxVus) return 0;
  return Math.floor(maxRequests / maxVus);
}
