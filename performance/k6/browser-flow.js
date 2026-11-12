/** Compartido con pruebas offline: no emite gtag manual ni escribe consentimiento. */
export async function browserFlow(page, plan) {
  await page.goto(plan.baseUrl + '/catalogo', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Aceptar analítica', exact: true }).click();
  // waitForFunction tiene distinto orden de argumentos en k6 y Playwright.
  await page.waitForFunction(() => (window.dataLayer || []).some(c => c[0] === 'event' && c[1] === 'page_view'));
  const product = await page.evaluate(async () => {
    const response = await fetch('/api/v1/products?pageSize=12', { cache: 'no-store' });
    if (!response.ok) throw new Error('CATALOG_UNAVAILABLE');
    const body = await response.json();
    const p = body.data.find(p => p.stock > 1 && /^[a-z0-9-]+$/.test(p.slug));
    return p ? { slug: p.slug, id: p.id, price: p.priceClp } : null;
  });
  if (!product) throw new Error('NO_SAFE_PRODUCT');
  await page.goto(plan.baseUrl + '/productos/' + product.slug, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.dataLayer || []).some(c => c[0] === 'event' && c[1] === 'view_item'));
  await page.locator('#add-quantity').fill('1');
  await page.getByRole('button', { name: 'Agregar al carrito' }).click();
  await page.getByRole('link', { name: 'Ver carrito' }).waitFor({ state: 'visible' });
  // Usar navegación real para que GA4 observe la visita al carrito.
  await page.goto(plan.baseUrl + '/carrito', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => (window.dataLayer || []).some(c => c[0] === 'event' && c[1] === 'page_view'));
  await page.locator('button.cart-remove').click();
  await page.getByRole('heading', { name: 'Tu carrito está vacío.', exact: true }).waitFor({ state: 'visible' });
  await page.waitForFunction(() => (window.dataLayer || []).some(c => c[0] === 'event' && c[1] === 'remove_from_cart'));
  // Se acumulan solo contadores saneados entre documentos, nunca cookies ni IDs de cliente.
  const events = await page.evaluate(() => window.__perfEvents || []);
  for (const name of ['view_item', 'add_to_cart', 'remove_from_cart']) {
    const found = events.filter(e => e.name === name);
    if (found.length !== 1 || found[0].traffic !== 'synthetic' || found[0].experiment !== plan.runId ||
        found[0].currency !== 'CLP' || found[0].quantity !== 1 || found[0].value !== product.price) {
      throw new Error('BROWSER_EVENT_INVALID');
    }
  }
  return { productId: product.id, unitPriceClp: product.price, quantity: 1,
    events: events.map(e => e.name), evidence: 'gtag_queue_not_google_receipt' };
}

/** Antes de cada documento: bloquea el ID oficial y observa la cola real de gtag. */
export function browserInit({ measurementId }) {
  window['ga-disable-G-VVKYV486NP'] = true;
  if (location.protocol !== 'http:' || location.hostname !== '127.0.0.1') return;
  const key = 'autoparts:performance-events';
  window.__perfEvents = JSON.parse(sessionStorage.getItem(key) || '[]');
  const layer = window.dataLayer = [];
  layer.push = function (...commands) {
    for (const command of commands) {
      if (command[0] === 'config' && command[1] !== measurementId) throw new Error('GA_DESTINATION_BLOCKED');
      if (command[0] === 'event') {
        const c = command[2] || {};
        if (c.send_to && c.send_to !== measurementId) throw new Error('GA_DESTINATION_BLOCKED');
        if (!['page_view', 'view_item', 'add_to_cart', 'remove_from_cart'].includes(command[1])) throw new Error('GA_EVENT_BLOCKED');
        window.__perfEvents.push({ name: command[1], traffic: c.traffic_kind,
          experiment: c.experiment_id, currency: c.currency, value: c.value,
          quantity: c.items?.[0]?.quantity });
        sessionStorage.setItem(key, JSON.stringify(window.__perfEvents));
      }
    }
    return Array.prototype.push.apply(this, commands);
  };
}
