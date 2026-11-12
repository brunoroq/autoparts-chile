import React from 'react';
import { createRoot } from 'react-dom/client';
import { AnalyticsProvider, CommerceView } from '../../src/components/analytics/analytics-provider';
import { AddToCart } from '../../src/components/cart/add-to-cart';
import { CartController } from '../../src/components/cart/cart-controller';
import { commerce } from '../../src/lib/analytics/contracts';
const id = '00000000-0000-4000-a000-000000000001';
const product = location.pathname.startsWith('/productos/');
const config = { enabled: true, measurementId: 'G-LAB12345', debug: false, vitals: false,
  environment: 'performance-local', experimentId: '12345678-1234-1234-1234-123456789abc',
  traffic: 'synthetic' as const, origin: location.origin };
createRoot(document.getElementById('root')!).render(<AnalyticsProvider config={config}>
  {product && <><CommerceView name="view_item" eventKey={id} value={commerce([{productId: id, unitPriceClp: 8990, quantity: 1}])}/><AddToCart productId={id} slug="fixture" stock={50}/></>}
  {location.pathname === '/carrito' && <CartController initialCart={null}/>}
</AnalyticsProvider>);
