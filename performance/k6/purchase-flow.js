import { validatePurchaseMarker } from './purchase-policy.js';

// Transporte síncrono inyectable: las pruebas no usan servidor ni cuentas reales.
// Ningún POST se repite: un resultado incierto detiene el recorrido.
export function purchaseFlow(transport, plan, account, key) {
  if (!/^[a-zA-Z0-9_-]{16,128}$/.test(key)) throw new Error('PURCHASE_KEY_INVALID');
  function call(method, route, body, headers = {}) {
    if (method === 'POST') isolated();
    const r = transport(method, route, body, headers);
    if (r.status === 0 || r.status >= 500) throw new Error('PURCHASE_RESULT_UNCERTAIN');
    if (r.status !== (route === '/api/v1/cart/items' ? 201 : 200)) throw new Error('PURCHASE_HTTP_' + r.status);
    return r.json();
  }
  function isolated() {
    const r = transport('GET', '/api/performance/status');
    if (r.status !== 200) throw new Error('PURCHASE_ISOLATION_REJECTED');
    validatePurchaseMarker(r.json(), plan);
  }
  isolated();
  let login = {};
  if (!account.sessionCookies) {
    const csrf = call('GET', '/api/auth/csrf');
    if (!csrf.csrfToken) throw new Error('PURCHASE_AUTH_REJECTED');
    login = call('POST', '/api/auth/callback/credentials', {
      csrfToken: csrf.csrfToken, email: account.email, password: account.password,
      callbackUrl: '/carrito', json: 'true',
    });
  }
  const session = call('GET', '/api/auth/session');
  if (login.error || !session.user?.id || session.user.email !== account.email) throw new Error('PURCHASE_AUTH_REJECTED');
  const cart = call('GET', '/api/v1/cart').data;
  if (!Array.isArray(cart?.items) || cart.items.length || !Number.isInteger(cart.version)) throw new Error('PURCHASE_CART_NOT_EMPTY');
  const products = call('GET', '/api/v1/products').data;
  const product = Array.isArray(products) && products.find(p => p.active !== false && p.stock > plan.maxPurchases && Number.isInteger(p.priceClp) && p.priceClp > 0);
  if (!product) throw new Error('PURCHASE_STOCK_BUDGET_REJECTED');
  call('GET', '/api/v1/products/' + product.id);
  const added = call('POST', '/api/v1/cart/items', { productId: product.id, quantity: 1 }, { 'If-Match': '"' + cart.version + '"' }).data;
  if (added?.items?.length !== 1 || added.items[0].quantity !== 1 || added.items[0].productId !== product.id || added.totalClp !== product.priceClp || !Number.isInteger(added.version)) throw new Error('PURCHASE_CART_INVALID');
  const pending = call('POST', '/api/v1/checkout', { cartVersion: added.version }, { 'Idempotency-Key': key }).data;
  if (pending?.status !== 'PENDING' || pending.payment?.provider !== 'SIMULATED' || pending.payment.status !== 'PENDING' || pending.totalClp !== product.priceClp) throw new Error('PURCHASE_PROVIDER_REJECTED');
  const paid = call('POST', '/api/v1/payments/' + pending.payment.id + '/simulate', { scenario: 'approved' }).data;
  if (paid?.id !== pending.id || paid.status !== 'PAID' || paid.payment?.provider !== 'SIMULATED' || paid.payment.status !== 'APPROVED' || paid.payment.providerState !== 'AUTHORIZED') throw new Error('PURCHASE_CONFIRMATION_INVALID');
  const order = call('GET', '/api/v1/orders/' + pending.id).data;
  const empty = call('GET', '/api/v1/cart').data;
  const finalProduct = call('GET', '/api/v1/products/' + product.id).data;
  if (order?.status !== 'PAID' || order.totalClp !== product.priceClp || order.items?.length !== 1 || order.items[0].quantity !== 1 || order.items[0].unitPriceClp !== product.priceClp || order.items[0].productId !== product.id || empty?.items?.length !== 0) throw new Error('PURCHASE_VERIFICATION_FAILED');
  if (finalProduct?.priceClp !== product.priceClp || !Number.isInteger(finalProduct.stock) || finalProduct.stock < 0 || finalProduct.stock > product.stock - 1) throw new Error('PURCHASE_INVENTORY_INVALID');
  return { orderId: order.id, amountClp: order.totalClp };
}
